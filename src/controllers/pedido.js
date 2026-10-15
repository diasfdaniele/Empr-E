import { buscarProduto } from '../models/produto.js';
import { obterCarrinhoExemplo } from '../models/pedido.js';
import { renderizarPagina, exibirIndisponibilidade } from '../utils/apresentacao.js';

export function exibirCarrinho(requisicao, resposta) {
  const carrinho = obterCarrinhoExemplo();
  const itens = carrinho.itens.map((item) => ({
    produto: buscarProduto(item.produtoId),
    quantidade: item.quantidade,
    variacao: item.variacao,
  }));
  renderizarPagina(resposta, 'carrinho', 'Carrinho demonstrativo | Empr-E', {
    itens,
    quantidade: carrinho.quantidade,
    total: carrinho.total,
  });
}

export function exibirPedidos(requisicao, resposta) {
  exibirIndisponibilidade(requisicao, resposta);
}
