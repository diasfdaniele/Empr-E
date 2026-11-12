import { randomBytes, timingSafeEqual } from 'node:crypto';
import { renderizarPagina, exibirIndisponibilidade } from '../utils/apresentacao.js';
import {
  carregarVendedor, listarProdutosVendedor, listarCategoriasVendedor,
  buscarProdutoVendedor, salvarProdutoVendedor, excluirProdutoVendedor, MODALIDADES,
} from '../services/produtos-vendedor.js';

export async function autorizarVendedor(req, res, next) {
  if (!req.session?.usuario || !req.session?.tokens?.accessToken) {
    return res.redirect('/login');
  }
  if (req.session.usuario.tipoPessoa !== 'pj') {
    return exibirIndisponibilidade(req, res, 403, 'Acesso restrito', 'Somente empresas vendedoras ativas podem gerenciar produtos.');
  }
  const origem = req.get('origin');
  if (req.method === 'POST' && origem) {
    try {
      if (new URL(origem).host !== req.get('host')) {
        return exibirIndisponibilidade(req, res, 403, 'Acesso restrito', 'Origem da solicitação inválida.');
      }
    } catch {
      return exibirIndisponibilidade(req, res, 403, 'Acesso restrito', 'Origem da solicitação inválida.');
    }
  }
  try {
    req.vendedor = await carregarVendedor(req);
    req.session.csrfProdutos ??= randomBytes(32).toString('hex');
    next();
  } catch (erro) {
    if (erro.status === 401) return res.redirect('/login');
    return exibirIndisponibilidade(req, res, erro.status ?? 502, 'Acesso restrito', erro.message);
  }
}

export function validarTokenProduto(req) {
  const recebido = typeof req.body?._csrf === 'string' ? req.body._csrf : '';
  const esperado = req.session?.csrfProdutos ?? '';
  const recebidoBuffer = Buffer.from(recebido);
  const esperadoBuffer = Buffer.from(esperado);
  return esperadoBuffer.length > 0 && recebidoBuffer.length === esperadoBuffer.length &&
    timingSafeEqual(recebidoBuffer, esperadoBuffer);
}

function bloquearTokenInvalido(req, res) {
  if (validarTokenProduto(req)) return false;
  exibirIndisponibilidade(req, res, 403, 'Solicitação inválida', 'Atualize a página antes de tentar novamente.');
  return true;
}

async function renderizarPainel(req, res, { produto = null, formulario = null, erro = null } = {}) {
  const [produtos, categorias] = await Promise.all([
    listarProdutosVendedor(req.vendedor), listarCategoriasVendedor(req.vendedor),
  ]);
  const valores = formulario ?? (produto ? {
    nome: produto.nome_produto, descricao: produto.descricao,
    categoria: String(produto.fk_categoria), preco: String(produto.preco_unitario),
    estoque: String(produto.estoque_atual), estoqueMinimo: String(produto.estoque_minimo),
    modalidade: produto.tipo_compra, ativo: produto.ativo ? 'on' : '',
  } : { nome: '', descricao: '', categoria: '', preco: '', estoque: '0', estoqueMinimo: '0', modalidade: 'Compra', ativo: 'on' });
  const aviso = req.session.avisoProdutos ?? null;
  delete req.session.avisoProdutos;
  return renderizarPagina(res, 'restritas/vendedor', 'Produtos da empresa | Empr-E', {
    empresa: req.vendedor.empresa, produtos, categorias, modalidades: MODALIDADES,
    produto, formulario: valores, csrf: req.session.csrfProdutos, erroFormulario: erro, aviso,
  });
}

export async function exibirPainel(req, res, next) {
  try {
    const produto = req.params.id ? await buscarProdutoVendedor(req.vendedor, req.params.id) : null;
    await renderizarPainel(req, res, { produto });
  } catch (erro) {
    if (erro.status) return exibirIndisponibilidade(req, res, erro.status, 'Produto indisponível', erro.message);
    next(erro);
  }
}

export async function salvarProduto(req, res, next) {
  if (bloquearTokenInvalido(req, res)) return;
  try {
    if (req.erroUpload) throw Object.assign(new Error(req.erroUpload), { status: 400 });
    const resultado = await salvarProdutoVendedor(
      req.vendedor, req.params.id, req.body, req.files ?? [], req.body.variacoes ?? [], req.body.removerImagens ?? []
    );
    req.session.avisoProdutos = {
      tipo: resultado.limpeza ? 'success' : 'warning',
      mensagem: resultado.limpeza ? 'Produto salvo com sucesso.' : 'Produto salvo. Alguns arquivos antigos não puderam ser removidos do Storage.',
    };
    return res.redirect(303, '/conta/vendedor');
  } catch (erro) {
    if (erro.status === 404 || erro.status === 403) {
      return exibirIndisponibilidade(req, res, erro.status, 'Produto indisponível', erro.message);
    }
    try {
      const produto = req.params.id ? await buscarProdutoVendedor(req.vendedor, req.params.id) : null;
      res.status(erro.status ?? 500);
      await renderizarPainel(req, res, { produto, formulario: req.body, erro: erro.message });
    } catch (erroRenderizacao) {
      next(erroRenderizacao);
    }
  }
}

export async function excluirProduto(req, res) {
  if (bloquearTokenInvalido(req, res)) return;
  try {
    const limpeza = await excluirProdutoVendedor(req.vendedor, req.params.id);
    req.session.avisoProdutos = {
      tipo: limpeza ? 'success' : 'warning',
      mensagem: limpeza ? 'Produto excluído com sucesso.' : 'Produto excluído. Alguns arquivos não puderam ser removidos do Storage.',
    };
    return res.redirect(303, '/conta/vendedor');
  } catch (erro) {
    return exibirIndisponibilidade(req, res, erro.status ?? 502, 'Não foi possível excluir', erro.message);
  }
}
