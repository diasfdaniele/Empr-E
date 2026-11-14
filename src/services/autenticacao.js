//autenticacao
import { createClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';

export const BUCKET_EMPRESAS = 'ImagensEmpresas';
export const LIMITE_LOGO_EMPRESA = 5 * 1024 * 1024;

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

export async function validarLogoEmpresa(arquivo) {
  if (!arquivo) return null;

  if (!Buffer.isBuffer(arquivo.buffer)) {
    throw new Error('Arquivo de logo inválido.');
  }
  if (arquivo.size > LIMITE_LOGO_EMPRESA || arquivo.buffer.length > LIMITE_LOGO_EMPRESA) {
    throw new Error('A logo deve ter no máximo 5 MB.');
  }

  let tipo;
  try {
    tipo = await fileTypeFromBuffer(arquivo.buffer);
  } catch {
    throw new Error('Arquivo de logo inválido.');
  }

  if (!tipo || !['image/jpeg', 'image/png', 'image/webp'].includes(tipo.mime)) {
    throw new Error('Envie a logo em formato JPEG, PNG ou WebP.');
  }

  return { buffer: arquivo.buffer, mime: tipo.mime, extensao: tipo.ext };
}

export async function cadastrarUsuario(dados, arquivoLogo = null) {
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
  if (arquivoLogo && perfilComercial !== 'vendedor') {
    throw new Error('A logo está disponível apenas para empresas vendedoras.');
  }
  const logo = perfilComercial === 'vendedor'
    ? await validarLogoEmpresa(arquivoLogo)
    : null;

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
  const cliente = criarClienteSupabase();
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
  let avisoLogo = null;

  // 3. Somente vendedores PJ criam um registro em empresas.
  if (perfilComercial === 'vendedor') {
    let logoUrl = null;
    let caminhoLogo = null;

    if (logo) {
      caminhoLogo = `${authData.user.id}/${randomUUID()}.${logo.extensao}`;
      let erroLogo;
      try {
        ({ error: erroLogo } = await cliente.storage
          .from(BUCKET_EMPRESAS)
          .upload(caminhoLogo, logo.buffer, {
            contentType: logo.mime,
            upsert: false,
          }));
      } catch (erro) {
        erroLogo = erro;
      }

      if (erroLogo) {
        const codigo = String(erroLogo.statusCode ?? erroLogo.status ?? 'indisponivel');
        console.error('Falha ao enviar logo da empresa:', {
          etapa: 'storage',
          codigo: /^\d{3}$/.test(codigo) ? codigo : 'indisponivel',
        });
        avisoLogo = 'A empresa foi cadastrada, mas não foi possível enviar a logo. Tente novamente mais tarde.';
        caminhoLogo = null;
      } else {
        logoUrl = cliente.storage.from(BUCKET_EMPRESAS).getPublicUrl(caminhoLogo).data.publicUrl;
      }
    }

    const { data: empresaCriada, error: empresaError } = await cliente
      .from('empresas')
      .insert({
        id_usuario: usuario.id_usuario,
        cnpj,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        status_conta: 'Ativo',
        logo_url: logoUrl,
      })
      .select('id_empresa, id_usuario, status_conta, nome_fantasia, logo_url')
      .single();

    if (empresaError) {
      if (caminhoLogo) {
        try {
          const { error: erroRemocaoLogo } = await cliente.storage
            .from(BUCKET_EMPRESAS)
            .remove([caminhoLogo]);
          if (erroRemocaoLogo) throw erroRemocaoLogo;
        } catch (erroRemocaoLogo) {
          console.error('Falha ao remover logo após erro no cadastro da empresa:', {
            etapa: 'storage',
            codigo: String(erroRemocaoLogo.statusCode ?? erroRemocaoLogo.status ?? 'indisponivel'),
          });
        }
      }
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
    avisoLogo,
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
    .select('id_usuario, id_auth, tipo_pessoa, nome_completo, login, cpf_pessoa')
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