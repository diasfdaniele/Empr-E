import {
  renderizarPagina,
  exibirIndisponibilidade,
} from '../utils/apresentacao.js';

import {
  cadastrarUsuario,
  autenticarUsuario,
} from '../services/autenticacao.js';

import {
    obterDadosCompletosConta,
    atualizarDadosPessoais,
    cadastrarEndereco,
    atualizarDadosEmpresa,
    atualizarEndereco,
    excluirEndereco
} from '../models/usuario.js';

export function exibirCadastro(req, res) {
    return renderizarPagina(
        res,
        'cadastro',
        'Criar conta | Empr-E',
        {
            erro: null,
            dados: {}
        }
    );
}

export function exibirLogin(req, res) {
  renderizarPagina(res, 'login', 'Entrar | Empr-E');
}


export async function processarCadastro(req, res) {
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
            if (erro) {
                return res.status(500).send(
                    'Não foi possível iniciar a sessão.'
                );
            }

            return res.redirect('/conta');
        });

    } catch (erro) {
        console.error('Erro ao cadastrar usuário:', erro);

        return renderizarPagina(
            res.status(400),
            'cadastro',
            'Criar conta | Empr-E',
            {
                erro: erro.message,

                dados: {
                    tipoPessoa: req.body.tipoPessoa,
                    perfilComercial: req.body.perfilComercial,
                    razaoSocial: req.body.razaoSocial,
                    nomeFantasia: req.body.nomeFantasia,
                    cnpj: req.body.cnpj,
                    nomeCompleto: req.body.nomeCompleto,
                    cpfPessoa: req.body.cpfPessoa,
                    email: req.body.email,
                    telefone: req.body.telefone
                }
            }
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

    if (
        !req.session?.usuario ||
        !req.session?.tokens?.accessToken
    ) {
        return res.redirect('/login');
    }

    const usuarioSessao = req.session.usuario;

    const usuarioId = usuarioSessao.id;

    try {

        const dadosBanco = await obterDadosCompletosConta(
            usuarioId,
            req
        );

        const formatarMoeda = (valor) =>
            new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(Number(valor) || 0);

        const formatarData = (dataIso) =>
            dataIso
                ? new Date(dataIso).toLocaleDateString('pt-BR')
                : '-';

        return renderizarPagina(
            res,
            'conta',
            'Minha conta | Empr-E',
            {
                usuario: dadosBanco.usuario,
                usuarioSessao,

                empresa: dadosBanco.empresa,

                enderecos: dadosBanco.enderecos,

                pedidos: dadosBanco.pedidos,

                query: req.query,

                formatarMoeda,
                formatarData
            }
        );

    } catch (erro) {

        console.error('Erro ao carregar conta:', erro);

        return res.status(500).send(
            'Não foi possível carregar os dados da sua conta.'
        );
    }
}

export function exibirAdministracao(req, res) {
  exibirIndisponibilidade(req, res);
}

export async function atualizarConta(req, res) {

    if (!req.session?.usuario) {
        return res.redirect('/login');
    }

    try {

        const usuarioId = req.session.usuario.id;

        const dados = await atualizarDadosPessoais(
            usuarioId,
            req,
            req.body
        );

        // Atualiza os dados armazenados na sessão.
        req.session.usuario.nome = dados.nome;

        req.session.usuario.cpf_pessoa = dados.cpf;

        return res.redirect('/conta?sucesso=perfil');

    } catch (erro) {

        console.error('Erro ao atualizar perfil:', erro);

        return res.redirect('/conta?erro=perfil');
    }
}

export async function cadastrarEnderecoConta(req, res) {

    if (!req.session?.usuario) {
        return res.redirect('/login');
    }

    try {

        const usuarioId = req.session.usuario.id;

        await cadastrarEndereco(
            usuarioId,
            req,
            req.body
        );

        return res.redirect('/conta?sucesso=endereco');

    } catch (erro) {

        console.error('Erro ao cadastrar endereço:', erro);

        return res.redirect('/conta?erro=endereco');
    }
}

export async function atualizarEmpresaConta(req, res) {
    if (!req.session?.usuario) {
        return res.redirect('/login');
    }

    if (req.session.usuario.tipoPessoa !== 'pj') {
        return res.redirect('/conta');
    }

    try {
        const usuarioId = req.session.usuario.id;

        await atualizarDadosEmpresa(
            usuarioId,
            req,
            req.body
        );

        return res.redirect('/conta?sucesso=empresa');

    } catch (erro) {
        console.error('Erro ao atualizar empresa:', erro);

        return res.redirect('/conta?erro=empresa');
    }
}


export async function atualizarEnderecoConta(req, res) {
    if (!req.session?.usuario) {
        return res.redirect('/login');
    }

    try {
        const usuarioId = req.session.usuario.id;
        const enderecoId = Number(req.params.id);

        if (!Number.isSafeInteger(enderecoId) || enderecoId < 1) {
            throw new Error('ID de endereço inválido.');
        }

        await atualizarEndereco(
            usuarioId,
            enderecoId,
            req,
            req.body
        );

        return res.redirect('/conta?sucesso=endereco-editado');

    } catch (erro) {
        console.error('Erro ao atualizar endereço:', erro);

        return res.redirect('/conta?erro=endereco-edicao');
    }
}

export async function excluirEnderecoConta(req, res) {
    if (!req.session?.usuario) {
        return res.redirect('/login');
    }

    try {
        const usuarioId = req.session.usuario.id;
        const enderecoId = Number(req.params.id);

        if (!Number.isSafeInteger(enderecoId) || enderecoId < 1) {
            throw new Error('Identificador de endereço inválido.');
        }

        await excluirEndereco(usuarioId, req, enderecoId);

        return res.redirect('/conta?sucesso=endereco-excluido');

    } catch (erro) {
        console.error('Erro ao excluir endereço:', erro);

        return res.redirect('/conta?erro=endereco-exclusao');
    }
}