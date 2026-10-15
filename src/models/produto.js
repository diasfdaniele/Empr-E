import { buscarEmpresa } from './empresa.js';
import { identificador, valorMonetario } from '../utils/validacao.js';

export class Categoria {
  constructor({ id, nome }) {
    this.id = identificador(id, 'Categoria');
    this.nome = identificador(nome, 'Nome da categoria');
    Object.freeze(this);
  }
}

const categorias = Object.freeze(
  [
    { id: 'mobilidade', nome: 'Mobilidade' },
    { id: 'visual', nome: 'Deficiência Visual' },
    { id: 'digital', nome: 'Acessibilidade Digital' },
    { id: 'auditiva', nome: 'Deficiência Auditiva' },
    { id: 'predial', nome: 'Acessibilidade Predial' },
  ].map((categoria) => new Categoria(categoria)),
);

export function listarCategorias() {
  return [...categorias];
}

export function buscarCategoria(id) {
  return categorias.find((categoria) => categoria.id === id);
}

export class Produto {
  constructor({
    id,
    nome,
    empresaId,
    categoriaId,
    descricao,
    preco,
    modalidade,
    unidade,
    imagens,
    variacoes,
  }) {
    this.id = identificador(id, 'Produto');
    this.nome = identificador(nome, 'Nome do produto');
    if (!buscarEmpresa(empresaId) || !buscarCategoria(categoriaId))
      throw new TypeError('Empresa ou categoria inexistente no catálogo demonstrativo.');
    if (!['compra', 'projeto'].includes(modalidade))
      throw new TypeError('Modalidade de compra inválida.');
    if (
      !Array.isArray(imagens) ||
      !imagens.length ||
      imagens.some((imagem) => typeof imagem !== 'string' || !imagem)
    )
      throw new TypeError('Produto exige imagens válidas.');
    if (
      !Array.isArray(variacoes) ||
      variacoes.length !== imagens.length ||
      variacoes.some((variacao) => typeof variacao !== 'string' || !variacao)
    )
      throw new TypeError('As variações devem corresponder às imagens.');
    this.empresaId = empresaId;
    this.categoriaId = categoriaId;
    this.descricao = identificador(descricao, 'Descrição');
    this.preco = valorMonetario(preco);
    this.modalidade = modalidade;
    this.unidade = identificador(unidade, 'Unidade');
    this.imagens = Object.freeze([...imagens]);
    this.variacoes = Object.freeze([...variacoes]);
    Object.freeze(this);
  }

  get empresa() {
    return buscarEmpresa(this.empresaId);
  }

  get categoria() {
    return buscarCategoria(this.categoriaId);
  }

  get nomeModalidade() {
    return this.modalidade === 'compra' ? 'Compra imediata' : 'Projeto personalizado';
  }
}

const produtos = Object.freeze(
  [
    {
      id: 'piso-tatil-alerta',
      nome: 'Piso Tátil de Alerta',
      empresaId: 'klinker',
      categoriaId: 'visual',
      preco: 25,
      modalidade: 'compra',
      unidade: 'peça',
      descricao:
        'Piso tátil de alerta para orientação de pessoas com deficiência visual. Indica obstáculos, desníveis, mudanças de direção e acessos a escadas e rampas.',
      imagens: ['alerta-1.jpg', 'alerta-2.jpg', 'alerta-3.jpg', 'alerta-4.jpg', 'alerta-5.jpg'],
      variacoes: ['Azul', 'Amarelo', 'Preto', 'Quartzo', 'Aleatório'],
    },
    {
      id: 'piso-tatil-direcional',
      nome: 'Piso Tátil Direcional',
      empresaId: 'klinker',
      categoriaId: 'visual',
      preco: 25,
      modalidade: 'compra',
      unidade: 'peça',
      descricao:
        'Piso tátil direcional para orientar uma rota acessível e indicar o sentido de deslocamento.',
      imagens: [
        'direcional-1.jpg',
        'direcional-2.jpg',
        'direcional-3.jpg',
        'direcional-4.jpg',
        'direcional-5.jpg',
      ],
      variacoes: ['Amarelo', 'Azul', 'Preto', 'Quartzo', 'Aleatório'],
    },
    {
      id: 'solucoes-software',
      nome: 'Soluções de Software Acessível',
      empresaId: 'acessify',
      categoriaId: 'digital',
      preco: 1000,
      modalidade: 'projeto',
      unidade: 'mês',
      descricao:
        'Auditoria, monitoramento e ajustes de acessibilidade para sistemas web de pessoas e empresas.',
      imagens: ['acessify-logo.png'],
      variacoes: ['Plano demonstrativo'],
    },
  ].map(
    (produto) =>
      new Produto({
        ...produto,
        imagens: produto.imagens.map((imagem) => `/assets/img/${imagem}`),
      }),
  ),
);

export const faixasPreco = Object.freeze({
  'ate-100': Object.freeze([0, 100]),
  '100-500': Object.freeze([100, 500]),
  '500-1000': Object.freeze([500, 1000]),
  '1000-5000': Object.freeze([1000, 5000]),
  '5000-plus': Object.freeze([5000, Infinity]),
});

const normalizar = (valor) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function listarProdutos(filtros = {}) {
  const termo = normalizar(filtros.busca || '');
  const faixa = faixasPreco[filtros.preco];
  return produtos.filter((produto) => {
    const empresa = buscarEmpresa(produto.empresaId);
    return (
      (!termo ||
        normalizar(`${produto.nome} ${empresa.nome} ${produto.descricao}`).includes(termo)) &&
      (!filtros.categoria || produto.categoriaId === filtros.categoria) &&
      (!filtros.empresa || empresa.nome === filtros.empresa) &&
      (!faixa ||
        ((filtros.preco === 'ate-100' ? produto.preco >= faixa[0] : produto.preco > faixa[0]) &&
          produto.preco <= faixa[1]))
    );
  });
}

export function buscarProduto(id) {
  return produtos.find((produto) => produto.id === id);
}
