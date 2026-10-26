//Controller Produto
import {
    buscarProduto,
    listarProdutos,
    listarCategorias,
    faixasPreco
} from '../models/produto.js';

import {
    renderizarPagina,
    exibirIndisponibilidade
} from '../utils/apresentacao.js';

import {
    paginaNaoEncontrada
} from '../middlewares/erros.js';

const opcoesPreco = [
    { valor: '', nome: 'Todas as faixas' },
    { valor: 'ate-100', nome: 'Até R$ 100' },
    { valor: '100-500', nome: 'Acima de R$ 100 até R$ 500' },
    { valor: '500-1000', nome: 'Acima de R$ 500 até R$ 1.000' },
    { valor: '1000-5000', nome: 'Acima de R$ 1.000 até R$ 5.000' },
    { valor: '5000-plus', nome: 'Acima de R$ 5.000' }
];

export async function exibirCatalogo(req, res, next) {
    try {
        const filtros = {};

        for (const chave of [
            'busca',
            'categoria',
            'preco',
            'empresa'
        ]) {
            const valor = req.query[chave];

            if (
                valor !== undefined &&
                typeof valor !== 'string'
            ) {
                return exibirIndisponibilidade(
                    res,
                    400,
                    'Filtro inválido.'
                );
            }

            filtros[chave] = (valor || '')
                .trim()
                .slice(0, 160);
        }

        if (
            filtros.categoria &&
            !/^[1-9]\d*$/.test(filtros.categoria)
        ) {
            return exibirIndisponibilidade(
                res,
                400,
                'Categoria inválida.'
            );
        }

        if (
            filtros.preco &&
            !Object.hasOwn(faixasPreco, filtros.preco)
        ) {
            return exibirIndisponibilidade(
                res,
                400,
                'Faixa de preço inválida.'
            );
        }

        const [categoriasBanco, produtos] = await Promise.all([
            listarCategorias(),
            listarProdutos(filtros)
        ]);

        const categorias = categoriasBanco.map(categoria => ({
            id: categoria.id_categoria,
            nome: categoria.nome_categoria
        }));

        renderizarPagina(
            res,
            'catalogo',
            'Catálogo | Empr-E',
            {
                produtos,
                filtros,
                categorias,
                opcoesPreco
            }
        );
    } catch (erro) {
        next(erro);
    }
}

export async function exibirDetalhes(req, res, next) {
    try {
        const produto = await buscarProduto(req.params.id);

        if (!produto) {
            return paginaNaoEncontrada(req, res);
        }

        renderizarPagina(
            res,
            'produto',
            `${produto.nome} | Empr-E`,
            { produto }
        );
    } catch (erro) {
        next(erro);
    }
}
