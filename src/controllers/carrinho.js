
import {
    adicionarItemCarrinho,
    definirQuantidadeItemCarrinho,
    limparCarrinhoUsuario,
    listarItensCarrinho,
    removerItemCarrinho
} from '../models/carrinho.js';

import { renderizarPagina } from '../utils/apresentacao.js';

function obterUsuarioAutenticado(req, res) {
    if (
        !req.session?.usuario ||
        !req.session?.tokens?.accessToken
    ) {
        res.redirect('/login');
        return null;
    }

    return req.session.usuario;
}

function informarErro(res, erro, status = 400) {
    return renderizarPagina(
        res.status(status),
        'indisponivel',
        'Carrinho | Empr-E',
        {
            tituloPagina: 'Não foi possível atualizar o carrinho',
            mensagem: erro.message ||
                'Ocorreu um erro ao acessar o carrinho. Tente novamente.'
        }
    );
}

function tratarSessaoExpirada(req, res, erro) {
    if (!/sessão expirou/i.test(erro.message ?? '')) {
        return false;
    }

    if (req.session) {
        req.session.destroy(() => res.redirect('/login'));
    } else {
        res.redirect('/login');
    }

    return true;
}

// GET /carrinho
export async function exibirCarrinho(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        const carrinho = await listarItensCarrinho(
            usuario.id,
            req
        );

        return renderizarPagina(
            res,
            'carrinho',
            'Seu carrinho | Empr-E',
            {
                itens: carrinho.itens,
                quantidade: carrinho.quantidade,
                total: carrinho.total
            }
        );
    } catch (erro) {
        if (tratarSessaoExpirada(req, res, erro)) return;

        console.error('Erro ao exibir carrinho:', erro);
        return informarErro(res, erro, 500);
    }
}

// POST /carrinho/itens
export async function adicionarItem(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        await adicionarItemCarrinho(
            usuario.id,
            req,
            req.body.produtoId,
            req.body.quantidade ?? 1,
            req.body.variacao
        );

        res.redirect(`/produto/${encodeURIComponent(req.body.produtoId)}`);
    } catch (erro) {
        if (tratarSessaoExpirada(req, res, erro)) return;

        console.error('Erro ao adicionar item:', erro);
        return informarErro(res, erro, 400);
    }
}

// POST /carrinho/itens/:produtoId/quantidade
export async function atualizarQuantidade(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        let novaQuantidade;

        if (req.body.acao === 'definir') {
            novaQuantidade = Number(req.body.quantidade);
        } else {
            const quantidadeAtual = Number(req.body.quantidadeAtual);

            if (
                !Number.isSafeInteger(quantidadeAtual) ||
                quantidadeAtual < 1 ||
                quantidadeAtual > 999
            ) {
                throw new Error('A quantidade atual é inválida.');
            }

            if (req.body.acao === 'aumentar') {
                novaQuantidade = quantidadeAtual + 1;
            } else if (req.body.acao === 'diminuir') {
                novaQuantidade = quantidadeAtual - 1;
            } else {
                throw new Error('A ação de quantidade é inválida.');
            }
        }

        if (
            !Number.isSafeInteger(novaQuantidade) ||
            novaQuantidade < 1 ||
            novaQuantidade > 999
        ) {
            throw new Error('A quantidade deve ser um número inteiro entre 1 e 999.');
        }

        await definirQuantidadeItemCarrinho(
            usuario.id,
            req,
            req.params.produtoId,
            novaQuantidade,
            req.body.variacao
        );

        return res.redirect('/carrinho');
    } catch (erro) {
        if (tratarSessaoExpirada(req, res, erro)) return;

        console.error('Erro ao atualizar quantidade:', erro);
        return informarErro(res, erro, 400);
    }
}

// POST /carrinho/itens/:produtoId/remover
export async function removerItem(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        await removerItemCarrinho(
            usuario.id,
            req,
            req.params.produtoId,
            req.body.variacao
        );

        return res.redirect('/carrinho');
    } catch (erro) {
        if (tratarSessaoExpirada(req, res, erro)) return;

        console.error('Erro ao remover item:', erro);
        return informarErro(res, erro, 400);
    }
}

// POST /carrinho/limpar
export async function limparCarrinho(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        await limparCarrinhoUsuario(usuario.id, req);

        return res.redirect('/carrinho');
    } catch (erro) {
        if (tratarSessaoExpirada(req, res, erro)) return;

        console.error('Erro ao limpar carrinho:', erro);
        return informarErro(res, erro, 400);
    }
}
