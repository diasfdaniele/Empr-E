//Controller usuario
import {
  renderizarPagina,
  exibirIndisponibilidade,
} from '../utils/apresentacao.js';

import {
  cadastrarUsuario,
  autenticarUsuario,
} from '../services/autenticacao.js';

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

    // Guarda a sessão no servidor antes de redirecionar.
    req.session.usuario = {
      id: resultado.usuario.id_usuario,
      idAuth: resultado.usuario.id_auth,
      tipoPessoa: resultado.usuario.tipo_pessoa,
      nome: resultado.usuario.nome_completo,
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

    // Evita reutilizar o identificador de sessão anterior.
    req.session.regenerate((erro) => {
      if (erro) {
        return res.status(500).send('Não foi possível iniciar a sessão.');
      }

      req.session.usuario = {
        id: resultado.usuario.id_usuario,
        idAuth: resultado.usuario.id_auth,
        tipoPessoa: resultado.usuario.tipo_pessoa,
        nome: resultado.usuario.nome_completo,
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

export function exibirConta(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }

  return exibirIndisponibilidade(req, res);
}

export function exibirFavoritos(req, res) {
  exibirIndisponibilidade(req, res);
}

export function exibirAdministracao(req, res) {
  exibirIndisponibilidade(req, res);
}