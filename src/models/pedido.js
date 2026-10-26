import { listarProdutos } from './produto.js';
import {
  identificador,
  inteiroPositivo,
  valorMonetario,
  calcularSubtotal,
  somarValores,
} from '../utils/validacao.js';


export class ItemPedido {
  constructor({ produtoId, quantidade, precoUnitario, variacao = '' }) {
    this.produtoId = identificador(produtoId, 'Produto');
    this.quantidade = inteiroPositivo(quantidade);
    this.precoUnitario = valorMonetario(precoUnitario);
    if (typeof variacao !== 'string') throw new TypeError('Variação deve ser texto.');
    this.variacao = variacao;
    Object.freeze(this);
  }

  get total() {
    return calcularSubtotal(this.precoUnitario, this.quantidade);
  }
}

export const situacoesPedido = Object.freeze(['aberto', 'pago', 'cancelado', 'enviado']);

export class Pedido {
  constructor({ id, compradorId, enderecoId, itens, situacao = 'aberto' }) {
    this.id = identificador(id, 'Pedido');
    this.compradorId = identificador(compradorId, 'Comprador');
    this.enderecoId = identificador(enderecoId, 'Endereço');
    if (!situacoesPedido.includes(situacao)) throw new TypeError('Situação de pedido inválida.');
    if (
      !Array.isArray(itens) ||
      !itens.length ||
      itens.some((item) => !(item instanceof ItemPedido))
    )
      throw new TypeError('Pedido exige itens válidos.');
    this.situacao = situacao;
    this.itens = Object.freeze([...itens]);
    Object.freeze(this);
  }

  get total() {
    return somarValores(this.itens.map((item) => item.total));
  }
}

export class Orcamento {
  constructor({ id, compradorId, produtoId, quantidade, descricao }) {
    this.id = identificador(id, 'Orçamento');
    this.compradorId = identificador(compradorId, 'Comprador');
    this.produtoId = identificador(produtoId, 'Produto');
    this.quantidade = inteiroPositivo(quantidade);
    this.descricao = identificador(descricao, 'Descrição do projeto');
    Object.freeze(this);
  }
}
