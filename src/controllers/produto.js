import { buscarProduto, listarProdutos, listarCategorias, faixasPreco } from '../models/produto.js';
import { renderizarPagina, exibirIndisponibilidade } from '../utils/apresentacao.js';
import { paginaNaoEncontrada } from '../middlewares/erros.js';

const opcoesPreco = [
  { valor: '', nome: 'Todas as faixas' },
  { valor: 'ate-100', nome: 'Até R$ 100' },
  { valor: '100-500', nome: 'Acima de R$ 100 até R$ 500' },
  { valor: '500-1000', nome: 'Acima de R$ 500 até R$ 1.000' },
  { valor: '1000-5000', nome: 'Acima de R$ 1.000 até R$ 5.000' },
  { valor: '5000-plus', nome: 'Acima de R$ 5.000' },
];

export function exibirCatalogo(requisicao, resposta) {
  const categorias = listarCategorias();
  const filtros = {};
  for (const chave of ['busca', 'categoria', 'empresa', 'preco']) {
    if (requisicao.query[chave] !== undefined && typeof requisicao.query[chave] !== 'string') {
      return exibirIndisponibilidade(
        requisicao,
        resposta,
        400,
        'Filtro inválido',
        'Informe apenas um valor por filtro.',
      );
    }
    filtros[chave] = (requisicao.query[chave] || '').trim().slice(0, 160);
  }
  if (
    (filtros.categoria && !categorias.some((categoria) => categoria.id === filtros.categoria)) ||
    (filtros.empresa && !resposta.locals.empresas.includes(filtros.empresa)) ||
    (filtros.preco && !Object.hasOwn(faixasPreco, filtros.preco))
  ) {
    return exibirIndisponibilidade(
      requisicao,
      resposta,
      400,
      'Filtro inválido',
      'Escolha uma das opções disponíveis no catálogo.',
    );
  }
  renderizarPagina(resposta, 'catalogo', 'Catálogo | Empr-E', {
    produtos: listarProdutos(filtros),
    filtros,
    categorias,
    opcoesPreco,
  });
}

export function exibirDetalhes(requisicao, resposta) {
  const produto = buscarProduto(requisicao.params.id);
  if (!produto) return paginaNaoEncontrada(requisicao, resposta);
  renderizarPagina(resposta, 'produto', `${produto.nome} | Empr-E`, { produto });
}
