import { 
    Router 
} from 'express';

import {
    exibirInicio,
    exibirInstitucional
} from '../controllers/paginas.js';

import { 
    carregarOpcoes 
} from '../controllers/empresa.js';

import {
    exibirCatalogo,
    exibirDetalhes
} from '../controllers/produto.js';

import {
    exibirListaEmpresas,
    exibirDetalhesEmpresa
} from '../controllers/empresa.js';

import { 
    exibirPedidos 
} from '../controllers/pedido.js';

import {
    exibirCarrinho,
    adicionarItem,
    atualizarQuantidade,
    removerItem,
    limparCarrinho
} from '../controllers/carrinho.js';

import {
    exibirPagamento, 
    processarPagamento 
} from '../controllers/pagamento.js';

import {
    exibirCadastro,
    exibirLogin,
    processarCadastro,
    processarLogin,
    encerrarSessao,
    exibirConta,
    atualizarConta,
    cadastrarEnderecoConta,
    atualizarEnderecoConta,
    atualizarEmpresaConta,
    exibirAdministracao,
    excluirEnderecoConta
} from '../controllers/usuario.js';

import { 
    exibirPainel,
    autorizarVendedor,
    salvarProduto,
    excluirProduto
} from '../controllers/vendas.js';
import { uploadProduto } from '../middlewares/upload-produto.js';
import { uploadLogoEmpresa } from '../middlewares/upload-logo-empresa.js';

const rotas = Router();

rotas.get('/', exibirInicio);

rotas.get('/cadastro', exibirCadastro);
rotas.post('/cadastro', uploadLogoEmpresa, processarCadastro);

rotas.get('/login', exibirLogin);
rotas.post('/login', processarLogin);
rotas.post('/logout', encerrarSessao);

rotas.get('/catalogo', carregarOpcoes, exibirCatalogo);
rotas.get('/produto/:id', exibirDetalhes);

rotas.get('/empresas', exibirListaEmpresas);
rotas.get('/empresa/:id', exibirDetalhesEmpresa);

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
rotas.post('/pagamento/confirmar', processarPagamento);

rotas.get('/institucional', exibirInstitucional);
rotas.get('/conta', exibirConta);
rotas.get('/conta/vendedor', autorizarVendedor, exibirPainel);
rotas.get('/conta/vendedor/produtos/:id/editar', autorizarVendedor, exibirPainel);
rotas.post('/conta/perfil', atualizarConta);
rotas.post('/conta/empresa', atualizarEmpresaConta);
rotas.post('/conta/enderecos', cadastrarEnderecoConta);
rotas.post('/conta/enderecos/:id', atualizarEnderecoConta);
rotas.post('/conta/enderecos/:id/excluir', excluirEnderecoConta);
rotas.post('/conta/vendedor/produtos', autorizarVendedor, uploadProduto, salvarProduto);
rotas.post('/conta/vendedor/produtos/:id', autorizarVendedor, uploadProduto, salvarProduto);
rotas.post('/conta/vendedor/produtos/:id/excluir', autorizarVendedor, excluirProduto);
rotas.get('/conta/admin', exibirAdministracao);
rotas.get('/conta/pedidos', exibirPedidos);

export default rotas;
