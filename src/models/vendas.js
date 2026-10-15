import { Pedido } from './pedido.js';
import { buscarProduto } from './produto.js';
import { buscarEmpresa } from './empresa.js';
import { somarValores } from '../utils/validacao.js';

export function resumirVendas(pedidos, empresaId = null) {
  if (!Array.isArray(pedidos) || pedidos.some((pedido) => !(pedido instanceof Pedido)))
    throw new TypeError('Resumo de vendas exige pedidos válidos.');
  if (empresaId !== null && !buscarEmpresa(empresaId))
    throw new TypeError('Empresa inexistente no catálogo demonstrativo.');
  const vendas = pedidos
    .filter((pedido) => ['pago', 'enviado'].includes(pedido.situacao))
    .map((pedido) => {
      const itens = pedido.itens.filter(
        (item) => empresaId === null || buscarProduto(item.produtoId)?.empresaId === empresaId,
      );
      return { pedido, itens };
    })
    .filter((venda) => venda.itens.length);
  const itens = vendas.flatMap((venda) => venda.itens);
  return Object.freeze({
    quantidadePedidos: vendas.length,
    quantidadeItens: itens.reduce((total, item) => total + item.quantidade, 0),
    total: somarValores(itens.map((item) => item.total)),
  });
}
