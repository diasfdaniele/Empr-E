import { createClient } from '@supabase/supabase-js';

function criarClienteSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function normalizarEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function somenteNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

export async function cadastrarUsuario(dados) {
  const cliente = criarClienteSupabase();

  const email = normalizarEmail(dados.email);
  const senha = String(dados.senha ?? '');
  const tipoPessoa = dados.tipoPessoa;
  const perfilComercial = dados.perfilComercial;

  if (!['pf', 'pj'].includes(tipoPessoa)) {
    throw new Error('Selecione um tipo de pessoa válido.');
  }

  if (!['comprador', 'vendedor'].includes(perfilComercial)) {
    throw new Error('Selecione um objetivo válido.');
  }

  if (perfilComercial === 'vendedor' && tipoPessoa !== 'pj') {
    throw new Error('Somente pessoas jurídicas podem vender.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido.');
  }

  if (senha.length < 8) {
    throw new Error('A senha deve possuir pelo menos 8 caracteres.');
  }

  if (senha !== dados.confirmarSenha) {
    throw new Error('As senhas não coincidem.');
  }

  const nomeCompleto = String(dados.nomeCompleto ?? '').trim();
  const cpfPessoa = somenteNumeros(dados.cpfPessoa);

  if (!nomeCompleto) {
    throw new Error('Informe seu nome completo.');
  }

  if (cpfPessoa.length !== 11) {
    throw new Error('O CPF deve conter 11 números.');
  }

  const cnpj = somenteNumeros(dados.cnpj);
  const razaoSocial = String(dados.razaoSocial ?? '').trim();
  const nomeFantasia = String(dados.nomeFantasia ?? '').trim();

  if (perfilComercial === 'vendedor') {
    if (
      cnpj.length !== 14 ||
      !razaoSocial ||
      !nomeFantasia
    ) {
      throw new Error(
        'Preencha corretamente o CNPJ, a razão social e o nome fantasia.'
      );
    }
  }

  // 1. Criar a credencial no Supabase Auth.
  const { data: authData, error: authError } =
    await cliente.auth.signUp({
      email,
      password: senha,
    });

  if (authError) {
    throw new Error(`Não foi possível criar a conta: ${authError.message}`);
  }

  if (!authData.user || !authData.session) {
    throw new Error(
      'O cadastro de autenticação foi iniciado, mas não há sessão ativa. ' +
      'Confira se a confirmação de e-mail está desativada no Supabase Auth.'
    );
  }

  // 2. Criar o perfil pessoal.
  const { data: usuario, error: usuarioError } = await cliente
    .from('usuarios')
    .insert({
      id_auth: authData.user.id,
      tipo_pessoa: tipoPessoa,
      login: email,
      nome_completo: nomeCompleto,
      cpf_pessoa: cpfPessoa,
    })
    .select('id_usuario, id_auth, tipo_pessoa, login, nome_completo')
    .single();

  if (usuarioError) {
    throw new Error(
      `A conta de autenticação foi criada, mas não foi possível salvar ` +
      `o perfil: ${usuarioError.message}`
    );
  }

  let empresa = null;

  // 3. Somente vendedores PJ criam um registro em empresas.
  if (perfilComercial === 'vendedor') {
    const { data: empresaCriada, error: empresaError } = await cliente
      .from('empresas')
      .insert({
        id_usuario: usuario.id_usuario,
        cnpj,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        status_conta: 'Aguardando Aprovação',
      })
      .select('id_empresa, id_usuario, status_conta, nome_fantasia')
      .single();

    if (empresaError) {
      // Tenta desfazer o perfil criado. Não remove a credencial do Auth.
      await cliente
        .from('usuarios')
        .delete()
        .eq('id_usuario', usuario.id_usuario);

      throw new Error(
        `O perfil foi criado, mas não foi possível cadastrar a empresa: ` +
        empresaError.message
      );
    }

    empresa = empresaCriada;
  }

  return {
    usuario,
    empresa,
    session: authData.session,
  };
}

export async function autenticarUsuario(emailInformado, senha) {
  const cliente = criarClienteSupabase();

  const { data, error } = await cliente.auth.signInWithPassword({
    email: normalizarEmail(emailInformado),
    password: String(senha ?? ''),
  });

  if (error || !data.user || !data.session) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const { data: usuario, error: perfilError } = await cliente
    .from('usuarios')
    .select('id_usuario, id_auth, tipo_pessoa, nome_completo, login')
    .eq('id_auth', data.user.id)
    .single();

  if (perfilError || !usuario) {
    throw new Error(
      'A autenticação foi realizada, mas o perfil do usuário não foi encontrado.'
    );
  }

  const { data: empresa, error: empresaError } = await cliente
    .from('empresas')
    .select('id_empresa, status_conta, nome_fantasia')
    .eq('id_usuario', usuario.id_usuario)
    .maybeSingle();

  if (empresaError) {
    throw new Error('Não foi possível consultar o vínculo empresarial.');
  }

  return {
    usuario,
    empresa,
    session: data.session,
  };
}