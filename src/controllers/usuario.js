import {
  renderizarPagina,
  exibirIndisponibilidade,
} from '../utils/apresentacao.js';

import {
  cadastrarUsuario,
  autenticarUsuario,
} from '../services/autenticacao.js';

import { obterDadosCompletosConta } from '../models/usuario.js';

export function exibirCadastro(req, res) {
  renderizarPagina(res, 'cadastro', 'Criar conta | Empr-E');
}

export function exibirLogin(req, res) {
  renderizarPagina(res, 'login', 'Entrar | Empr-E');
}

export async function processarCadastro(req, res) {
  console.log('Campos recebidos pelo controller:', Object.keys(req.body ?? {}));
  try {
    const resultado = await cadastrarUsuario(req.body);

    req.session.usuario = {
      id: resultado.usuario.id_usuario,
      idAuth: resultado.usuario.id_auth,
      tipoPessoa: resultado.usuario.tipo_pessoa,
      nome: resultado.usuario.nome_completo,
      login: resultado.usuario.login,
      cpf_pessoa: resultado.usuario.cpf_pessoa,
      empresaId: resultado.empresa?.id_empresa ?? null,
      statusEmpresa: resultado.empresa?.status_conta ?? null,
    };

    req.session.tokens = {
      accessToken: resultado.session.access_token,
      refreshToken: resultado.session.refresh_token,
      expiresAt: resultado.session.expires_at,
    };

    req.session.save((erro) => {
      if (erro) return res.status(500).send('Não foi possível iniciar a sessão.');
      return res.redirect('/conta');
    });
  } catch (erro) {
    res.locals.erro = erro.message;
    res.status(400);
    return renderizarPagina(
      res,
      'cadastro',
      'Criar conta | Empr-E'
    );
  }
}

export async function processarLogin(req, res) {
  try {
    const resultado = await autenticarUsuario(
      req.body.email,
      req.body.senha
    );

    req.session.regenerate((erro) => {
      if (erro) {
        return res.status(500).send('Não foi possível iniciar a sessão.');
      }

      req.session.usuario = {
        id: resultado.usuario.id_usuario,
        idAuth: resultado.usuario.id_auth,
        tipoPessoa: resultado.usuario.tipo_pessoa,
        nome: resultado.usuario.nome_completo,
        login: resultado.usuario.login,
        cpf_pessoa: resultado.usuario.cpf_pessoa,
        empresaId: resultado.empresa?.id_empresa ?? null,
        statusEmpresa: resultado.empresa?.status_conta ?? null,
      };

      req.session.tokens = {
        accessToken: resultado.session.access_token,
        refreshToken: resultado.session.refresh_token,
        expiresAt: resultado.session.expires_at,
      };

      req.session.save((erroAoSalvar) => {
        if (erroAoSalvar) {
          return res.status(500).send('Não foi possível iniciar a sessão.');
        }

        return res.redirect('/conta');
      });
    });
  } catch (erro) {
    res.locals.erro = erro.message;
    res.status(401);
    return renderizarPagina(res, 'login', 'Entrar | Empr-E');
  }
}

export function encerrarSessao(req, res) {
  req.session.destroy((erro) => {
    if (erro) {
      return res.status(500).send('Não foi possível encerrar a sessão.');
    }

    res.clearCookie('empre.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.redirect('/login');
  });
}

export async function exibirConta(req, res) {
  if (!req.session?.usuario) {
    return res.redirect('/login');
  }

  try {
    const usuarioSessao = req.session.usuario;
    const usuarioId = usuarioSessao.id || usuarioSessao.id_usuario;

    const dadosBanco = await obterDadosCompletosConta(usuarioId).catch(() => ({
      usuario: null,
      endereco: null,
      pedidos: []
    }));

    res.locals.usuario = {
      ...usuarioSessao,
      ...(dadosBanco.usuario || {})
    };

    const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
    const formatarData = (dataIso) => dataIso ? new Date(dataIso).toLocaleDateString('pt-BR') : '-';

    return renderizarPagina(
      res,
      'conta', // Alterado de 'restritas/conta' para 'conta'
      'Minha conta | Empr-E',
      {
        endereco: dadosBanco.endereco || null,
        pedidos: dadosBanco.pedidos || [],
        formatarMoeda,
        formatarData
      }
    );
  } catch (erro) {
    console.error('Erro ao renderizar conta:', erro);
    return renderizarPagina(res, 'conta', 'Minha conta | Empr-E');
  }
}

export function exibirAdministracao(req, res) {
  exibirIndisponibilidade(req, res);
}