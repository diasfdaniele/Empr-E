import { identificador, valorMonetario, calcularSubtotal } from '../utils/validacao.js';
import { buscarProduto } from './produto.js';

export const metodosPagamento = Object.freeze(['pix', 'cartao', 'boleto']);

export class Pagamento {
  constructor({ id, pedidoId, metodo, valor }) {
    this.id = identificador(id, 'Pagamento');
    this.pedidoId = identificador(pedidoId, 'Pedido');
    if (!metodosPagamento.includes(metodo)) throw new TypeError('Método de pagamento inválido.');
    this.metodo = metodo;
    this.valor = valorMonetario(valor);
    Object.freeze(this);
  }
}

export function obterPagamentoExemplo() {
  const produto = buscarProduto('piso-tatil-alerta');
  const quantidade = 2;
  return Object.freeze({ produto, quantidade, total: calcularSubtotal(produto.preco, quantidade) });
}
