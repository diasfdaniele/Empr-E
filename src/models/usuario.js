import { identificador } from '../utils/validacao.js';
import { supabase } from '../../config/db.js';
import { createClient } from '@supabase/supabase-js';

// Cria um cliente Supabase utilizando a sessão do usuário.
function clienteDaSessao(req) {
    const token = req.session?.tokens?.accessToken;

    if (!token) {
        throw new Error('Sessão expirada. Entre novamente.');
    }

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        }
    );
}


export const tiposPessoa = Object.freeze(['pf', 'pj']);
export const papeisUsuario = Object.freeze(['comprador', 'vendedor', 'administrador']);

export class Usuario {
  constructor({
    id,
    idAuth,
    tipoPessoa,
    login,
    nomeCompleto,
    cpfPessoa,
    criadoEm = null,
    empresa = null,
  }) {
    const idNumerico = Number(id);

    if (!Number.isSafeInteger(idNumerico) || idNumerico < 1) {
      throw new TypeError('ID do usuário inválido.');
    }

    if (!tiposPessoa.includes(tipoPessoa)) {
      throw new TypeError('Tipo de pessoa inválido.');
    }

    if (!idAuth || typeof idAuth !== 'string') {
      throw new TypeError('Identificador do Supabase Auth inválido.');
    }

    if (!login || !nomeCompleto || !cpfPessoa) {
      throw new TypeError('Os dados pessoais obrigatórios estão ausentes.');
    }

    if (tipoPessoa === 'pf' && empresa !== null) {
      throw new TypeError(
        'Pessoa física não pode possuir vínculo empresarial neste perfil.'
      );
    }

    this.id = idNumerico;
    this.idAuth = idAuth;
    this.tipoPessoa = tipoPessoa;
    this.login = login;
    this.nomeCompleto = nomeCompleto;
    this.cpfPessoa = cpfPessoa;
    this.criadoEm = criadoEm;
    this.empresa = empresa;

    Object.freeze(this);
  }

  get podeComprar() {
    return true;
  }

  get podeVender() {
    return (
      this.tipoPessoa === 'pj' &&
      this.empresa !== null &&
      this.empresa.statusConta === 'Ativo'
    );
  }
}

export const tiposEndereco = Object.freeze(['sede', 'entrega', 'faturamento']);

export class Endereco {
  constructor({
    id,
    usuarioId,
    tipo,
    cep,
    logradouro,
    numero = '',
    bairro,
    cidade,
    estado,
    complemento = '',
  }) {
    this.id = identificador(id, 'Endereço');
    this.usuarioId = identificador(usuarioId, 'Usuário');
    if (!tiposEndereco.includes(tipo)) throw new TypeError('Tipo de endereço inválido.');
    if (!/^\d{8}$/.test(cep) || !/^[A-Z]{2}$/.test(estado))
      throw new TypeError('CEP ou UF inválido.');
    this.tipo = tipo;
    this.cep = cep;
    this.logradouro = identificador(logradouro, 'Logradouro');
    this.numero = String(numero);
    this.bairro = identificador(bairro, 'Bairro');
    this.cidade = identificador(cidade, 'Cidade');
    this.estado = estado;
    this.complemento = String(complemento);
    Object.freeze(this);
  }
}

export const tiposContato = Object.freeze(['telefone', 'email', 'whatsapp']);

export class Contato {
  constructor({ id, usuarioId, tipo, valor }) {
    this.id = identificador(id, 'Contato');
    this.usuarioId = identificador(usuarioId, 'Usuário');
    if (!tiposContato.includes(tipo)) throw new TypeError('Tipo de contato inválido.');
    this.tipo = tipo;
    this.valor = identificador(valor, 'Contato');
    Object.freeze(this);
  }
}

export async function obterDadosCompletosConta(usuarioId, req) {

    const cliente = clienteDaSessao(req);

    const [
        resultadoUsuario,
        resultadoEmpresa,
        resultadoEnderecos,
        resultadoPedidos
    ] = await Promise.all([

        cliente
            .from('usuarios')
            .select('*')
            .eq('id_usuario', usuarioId)
            .maybeSingle(),

        cliente
            .from('empresas')
            .select('*')
            .eq('id_usuario', usuarioId)
            .maybeSingle(),

        cliente
            .from('enderecos')
            .select('*')
            .eq('idUsuario', usuarioId)
            .order('id_endereco', { ascending: true }),

        cliente
            .from('pedidos')
            .select('*')
            .eq('fk_comprador', usuarioId)
            .order('data_emissao', { ascending: false })
            .limit(5)

    ]);

    if (resultadoUsuario.error) {
        throw resultadoUsuario.error;
    }

    if (resultadoEmpresa.error) {
        throw resultadoEmpresa.error;
    }

    if (resultadoEnderecos.error) {
        throw resultadoEnderecos.error;
    }

    if (resultadoPedidos.error) {
        throw resultadoPedidos.error;
    }

    return {
        usuario: resultadoUsuario.data,
        empresa: resultadoEmpresa.data,
        enderecos: resultadoEnderecos.data || [],
        pedidos: resultadoPedidos.data || []
    };
}

export async function atualizarDadosPessoais(usuarioId, req, dados) {

    const cliente = clienteDaSessao(req);

    const nome = String(dados.nomeCompleto || '').trim();

    const cpf = String(dados.cpfPessoa || '')
        .replace(/\D/g, '');

    if (nome.length < 3) {
        throw new Error('Informe seu nome completo.');
    }

    if (!/^\d{11}$/.test(cpf)) {
        throw new Error('Informe um CPF válido.');
    }

    const { error } = await cliente
        .from('usuarios')
        .update({
            nome_completo: nome,
            cpf_pessoa: cpf
        })
        .eq('id_usuario', usuarioId);

    if (error) {
        throw new Error(
            `Não foi possível atualizar os dados: ${error.message}`
        );
    }

    return {
        nome,
        cpf
    };
}

export async function cadastrarEndereco(usuarioId, req, dados) {

    const cliente = clienteDaSessao(req);

    const endereco = {

        idUsuario: Number(usuarioId),

        tipo_endereco: 'Entrega',

        cep: String(dados.cep || '')
            .replace(/\D/g, ''),

        logradouro: String(dados.logradouro || '').trim(),

        numero: String(dados.numero || '').trim(),

        complemento: String(dados.complemento || '').trim(),

        bairro: String(dados.bairro || '').trim(),

        cidade: String(dados.cidade || '').trim(),

        estado: String(dados.estado || '')
            .trim()
            .toUpperCase()

    };

    if (!/^\d{8}$/.test(endereco.cep)) {
        throw new Error('Informe um CEP válido.');
    }

    // Verifica se o CEP realmente existe.
    const respostaCep = await fetch(
        `https://viacep.com.br/ws/${endereco.cep}/json/`
    );

    if (!respostaCep.ok) {
        throw new Error('Não foi possível validar o CEP.');
    }

    const dadosCep = await respostaCep.json();

    if (dadosCep.erro) {
        throw new Error('O CEP informado não foi encontrado.');
    }

    if (
        !endereco.logradouro ||
        !endereco.numero ||
        !endereco.bairro ||
        !endereco.cidade ||
        !/^[A-Z]{2}$/.test(endereco.estado)
    ) {
        throw new Error('Preencha todos os campos obrigatórios.');
    }

    const { error } = await cliente
        .from('enderecos')
        .insert(endereco);

    if (error) {
        throw new Error(
            `Não foi possível cadastrar o endereço: ${error.message}`
        );
    }

    return true;
}

export async function atualizarDadosEmpresa(usuarioId, req, dados) {
    const cliente = clienteDaSessao(req);

    const cnpj = String(dados.cnpj || '').replace(/\D/g, '');
    const razaoSocial = String(dados.razaoSocial || '').trim();
    const nomeFantasia = String(dados.nomeFantasia || '').trim();

    if (!/^\d{14}$/.test(cnpj)) {
        throw new Error('Informe um CNPJ com 14 dígitos.');
    }

    if (razaoSocial.length < 2) {
        throw new Error('Informe a razão social.');
    }

    if (nomeFantasia.length < 2) {
        throw new Error('Informe o nome fantasia.');
    }

    const empresaAtualizada = {
        cnpj,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        inscricao_estadual: String(dados.inscricaoEstadual || '').trim() || null,
        categoria_empresa: String(dados.categoriaEmpresa || '').trim() || null,
        tipo_empresa: String(dados.tipoEmpresa || '').trim() || null,
        descricao: String(dados.descricao || '').trim() || null,
        site: String(dados.site || '').trim() || null
    };

    const { data, error } = await cliente
        .from('empresas')
        .update(empresaAtualizada)
        .eq('id_usuario', usuarioId)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(
            `Não foi possível atualizar os dados da empresa: ${error.message}`
        );
    }

    if (!data) {
        throw new Error(
            'Empresa não encontrada ou você não possui permissão para editá-la.'
        );
    }

    return data;
}

export async function atualizarEndereco(usuarioId, enderecoId, req, dados) {
    const cliente = clienteDaSessao(req);

    const endereco = {
        cep: String(dados.cep || '').replace(/\D/g, ''),
        logradouro: String(dados.logradouro || '').trim(),
        numero: String(dados.numero || '').trim(),
        complemento: String(dados.complemento || '').trim(),
        bairro: String(dados.bairro || '').trim(),
        cidade: String(dados.cidade || '').trim(),
        estado: String(dados.estado || '').trim().toUpperCase()
    };

    if (!/^\d{8}$/.test(endereco.cep)) {
        throw new Error('Informe um CEP válido.');
    }

    const respostaCep = await fetch(
        `https://viacep.com.br/ws/${endereco.cep}/json/`
    );

    if (!respostaCep.ok) {
        throw new Error('Não foi possível validar o CEP.');
    }

    const dadosCep = await respostaCep.json();

    if (dadosCep.erro) {
        throw new Error('O CEP informado não foi encontrado.');
    }

    if (
        !endereco.logradouro ||
        !endereco.numero ||
        !endereco.bairro ||
        !endereco.cidade ||
        !/^[A-Z]{2}$/.test(endereco.estado)
    ) {
        throw new Error('Preencha todos os campos obrigatórios.');
    }

    const { data, error } = await cliente
        .from('enderecos')
        .update(endereco)
        .eq('id_endereco', enderecoId)
        .eq('idUsuario', usuarioId)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(
            `Não foi possível atualizar o endereço: ${error.message}`
        );
    }

    if (!data) {
        throw new Error(
            'Endereço não encontrado ou você não possui permissão para editá-lo.'
        );
    }

    return data;
}

export async function excluirEndereco(usuarioId, req, enderecoId) {
    const cliente = clienteDaSessao(req);

    const { data, error } = await cliente
        .from('enderecos')
        .delete()
        .eq('id_endereco', enderecoId)
        .eq('idUsuario', usuarioId)
        .select('id_endereco')
        .maybeSingle();

    if (error) {
        throw new Error(`Não foi possível excluir o endereço: ${error.message}`);
    }

    if (!data) {
        throw new Error('Endereço não encontrado ou você não possui permissão para excluí-lo.');
    }

    return true;
}