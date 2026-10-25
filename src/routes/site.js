//Routes
import { Router } from 'express';
import { exibirInicio, exibirInstitucional } from '../controllers/paginas.js';
import { carregarOpcoes } from '../controllers/empresa.js';
import { exibirCatalogo, exibirDetalhes } from '../controllers/produto.js';
import { exibirCarrinho, exibirPedidos } from '../controllers/pedido.js';
import { exibirPagamento } from '../controllers/pagamento.js';
import {
  exibirCadastro,
  exibirLogin,
  processarCadastro,
  processarLogin,
  encerrarSessao,
  exibirConta,
  exibirFavoritos,
  exibirAdministracao,
} from '../controllers/usuario.js';
import { exibirPainel } from '../controllers/vendas.js';

const rotas = Router();
rotas.get('/', exibirInicio);
rotas.get('/cadastro', exibirCadastro);
rotas.post('/cadastro', processarCadastro);
rotas.get('/catalogo', carregarOpcoes, exibirCatalogo);
rotas.get('/produto/:id', exibirDetalhes);
rotas.get('/carrinho', exibirCarrinho);
rotas.get('/pagamento', exibirPagamento);
rotas.get('/cadastro', exibirCadastro);
rotas.get('/login', exibirLogin);
rotas.post('/login', processarLogin);
rotas.post('/logout', encerrarSessao);
rotas.get('/institucional', exibirInstitucional);
rotas.get('/conta', exibirConta);
rotas.get('/conta/vendedor', exibirPainel);
rotas.get('/conta/admin', exibirAdministracao);
rotas.get('/conta/favoritos', exibirFavoritos);
rotas.get('/conta/pedidos', exibirPedidos);
export default rotas;
