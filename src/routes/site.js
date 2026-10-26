
import { Router } from 'express';

import {
    exibirInicio,
    exibirInstitucional
} from '../controllers/paginas.js';

import { carregarOpcoes } from '../controllers/empresa.js';

import {
    exibirCatalogo,
    exibirDetalhes
} from '../controllers/produto.js';

import { exibirPedidos } from '../controllers/pedido.js';

import {
    exibirCarrinho,
    adicionarItem,
    atualizarQuantidade,
    removerItem,
    limparCarrinho
} from '../controllers/carrinho.js';

import { exibirPagamento } from '../controllers/pagamento.js';

import {
    exibirCadastro,
    exibirLogin,
    processarCadastro,
    processarLogin,
    encerrarSessao,
    exibirConta,
    exibirFavoritos,
    exibirAdministracao
} from '../controllers/usuario.js';

import { exibirPainel } from '../controllers/vendas.js';

const rotas = Router();

rotas.get('/', exibirInicio);

rotas.get('/cadastro', exibirCadastro);
rotas.post('/cadastro', processarCadastro);

rotas.get('/login', exibirLogin);
rotas.post('/login', processarLogin);
rotas.post('/logout', encerrarSessao);

rotas.get('/catalogo', carregarOpcoes, exibirCatalogo);
rotas.get('/produto/:id', exibirDetalhes);

rotas.get('/carrinho', exibirCarrinho);
rotas.post('/carrinho/itens', adicionarItem);

rotas.post(
    '/carrinho/itens/:produtoId/quantidade',
    atualizarQuantidade
);

rotas.post(
    '/carrinho/itens/:produtoId/remover',
    removerItem
);

rotas.post('/carrinho/limpar', limparCarrinho);

rotas.get('/pagamento', exibirPagamento);

rotas.get('/institucional', exibirInstitucional);
rotas.get('/conta', exibirConta);
rotas.get('/conta/vendedor', exibirPainel);
rotas.get('/conta/admin', exibirAdministracao);
rotas.get('/conta/favoritos', exibirFavoritos);
rotas.get('/conta/pedidos', exibirPedidos);
rotas.post('/logout', (req, res) => {
    if (!req.session) {
        return res.redirect('/');
    }

    req.session.destroy((erro) => {
        if (erro) {
            console.error('Erro ao encerrar sessão:', erro);
            return res.redirect('/');
        }

        res.clearCookie('connect.sid');
        return res.redirect('/');
    });
});

export default rotas;
