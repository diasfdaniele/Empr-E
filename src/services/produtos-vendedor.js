import { createClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';

export const BUCKET_PRODUTOS = 'ImagensProdutos';
export const LIMITE_IMAGEM = 5 * 1024 * 1024;
export const LIMITE_FOTOS = 6;
export const MODALIDADES = ['Compra', 'Sob Consulta'];

export function erroProduto(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

export async function verificarEmpresaVendedora(cliente, idAuth) {
  const { data: usuario, error: erroUsuario } = await cliente
    .from('usuarios')
    .select('id_usuario, tipo_pessoa')
    .eq('id_auth', idAuth)
    .single();

  if (erroUsuario || usuario?.tipo_pessoa !== 'pj') {
    throw erroProduto('Somente empresas podem gerenciar produtos.', 403);
  }

  const { data: empresa, error } = await cliente
    .from('empresas')
    .select('id_empresa, id_usuario, nome_fantasia, status_conta')
    .eq('id_usuario', usuario.id_usuario)
    .maybeSingle();

  if (error || !empresa || empresa.status_conta !== 'Ativo') {
    throw erroProduto('Sua empresa precisa estar ativa para gerenciar produtos.', 403);
  }

  return empresa;
}

export async function carregarVendedor(req) {
  const tokens = req.session?.tokens;
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw erroProduto('Entre novamente para acessar seus produtos.', 401);
  }

  const cliente = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { data, error } = await cliente.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error || !data.user || !data.session) {
    throw erroProduto('Sua sessão expirou. Entre novamente.', 401);
  }

  req.session.tokens = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
  const empresa = await verificarEmpresaVendedora(cliente, data.user.id);
  return { cliente, empresa, idAuth: data.user.id };
}

export function validarIdProduto(valor) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw erroProduto('Produto inválido.', 404);
  }
  return id;
}

export function validarDadosProduto(dados) {
  const texto = (valor) => typeof valor === 'string' ? valor.trim() : '';
  const nome = texto(dados.nome);
  const descricao = texto(dados.descricao);
  const categoria = Number(dados.categoria);
  const preco = Number(dados.preco);
  const estoque = Number(dados.estoque);
  const minimo = Number(dados.estoqueMinimo);

  if (!nome || nome.length > 160 || !descricao || descricao.length > 5000) {
    throw erroProduto('Informe um nome de até 160 caracteres e uma descrição de até 5.000 caracteres.');
  }
  if (!Number.isSafeInteger(categoria) || categoria < 1) {
    throw erroProduto('Selecione uma categoria válida.');
  }
  if (!MODALIDADES.includes(dados.modalidade)) {
    throw erroProduto('Selecione uma modalidade válida.');
  }
  if (
    texto(dados.preco) === '' || !Number.isFinite(preco) || preco < 0 || preco > 99999999.99 ||
    (dados.modalidade === 'Compra' && preco <= 0) ||
    Math.abs(preco * 100 - Math.round(preco * 100)) > 0.00001
  ) {
    throw erroProduto('Informe um preço válido, com no máximo duas casas decimais.');
  }
  for (const [valor, original] of [[estoque, dados.estoque], [minimo, dados.estoqueMinimo]]) {
    if (texto(original) === '' || !Number.isSafeInteger(valor) || valor < 0 || valor > 2147483647) {
      throw erroProduto('Informe estoques inteiros, maiores ou iguais a zero.');
    }
  }

  return {
    nome_produto: nome,
    descricao,
    fk_categoria: categoria,
    preco_unitario: preco,
    estoque_atual: estoque,
    estoque_minimo: minimo,
    tipo_compra: dados.modalidade,
    ativo: dados.ativo === 'on',
  };
}

export async function validarFotos(arquivos = [], variacoes = []) {
  if (arquivos.length > LIMITE_FOTOS) throw erroProduto('Envie no máximo seis fotos.');
  const nomes = Array.isArray(variacoes) ? variacoes : [variacoes];
  const fotos = [];
  for (const [indice, arquivo] of arquivos.entries()) {
    if (arquivo.size > LIMITE_IMAGEM || arquivo.buffer.length > LIMITE_IMAGEM) {
      throw erroProduto('Cada foto deve ter no máximo 5 MB.');
    }
    let tipo;
    try {
      tipo = await fileTypeFromBuffer(arquivo.buffer);
    } catch {
      throw erroProduto('Arquivo de imagem inválido.');
    }
    if (!tipo || !['image/jpeg', 'image/png', 'image/webp'].includes(tipo.mime)) {
      throw erroProduto('Envie apenas fotos JPEG, PNG ou WebP.');
    }
    const variacao = typeof nomes[indice] === 'string' ? nomes[indice].trim() : '';
    if (!variacao || variacao.length > 80) {
      throw erroProduto('Informe o nome de cada variação, com até 80 caracteres.');
    }
    fotos.push({ buffer: arquivo.buffer, mime: tipo.mime, extensao: tipo.ext, variacao });
  }
  return fotos;
}

export async function listarProdutosVendedor({ cliente, empresa }) {
  const { data, error } = await cliente.from('produtos')
    .select('id_produto, nome_produto, preco_unitario, estoque_atual, tipo_compra, ativo')
    .eq('fk_vendedor', empresa.id_empresa)
    .order('nome_produto');
  if (error) throw erroProduto('Não foi possível carregar os produtos da empresa.', 502);
  return data ?? [];
}

export async function buscarProdutoVendedor({ cliente, empresa }, identificador) {
  const id = validarIdProduto(identificador);
  const { data, error } = await cliente.from('produtos')
    .select('id_produto, nome_produto, descricao, fk_categoria, preco_unitario, estoque_atual, estoque_minimo, tipo_compra, ativo')
    .eq('id_produto', id)
    .eq('fk_vendedor', empresa.id_empresa)
    .maybeSingle();
  if (error) throw erroProduto('Não foi possível consultar o produto.', 502);
  if (!data) throw erroProduto('Produto não encontrado na sua empresa.', 404);
  const { data: imagens, error: erroImagens } = await cliente.from('produtosImagens')
    .select('idImagem, caminho_arquivo, nome_variacao')
    .eq('idProduto', id)
    .order('idImagem');
  if (erroImagens) throw erroProduto('Não foi possível consultar as fotos do produto.', 502);
  return { ...data, imagens: imagens ?? [] };
}

export async function listarCategoriasVendedor({ cliente }) {
  const { data, error } = await cliente.from('categorias')
    .select('id_categoria, nome_categoria').order('nome_categoria');
  if (error) throw erroProduto('Não foi possível carregar as categorias.', 502);
  return data ?? [];
}

function mensagemBanco(error, mensagem) {
  const codigo = String(error?.code ?? 'indisponivel');
  const referencia = /^[a-z0-9_]{1,24}$/i.test(codigo) ? codigo : 'indisponivel';
  console.error('Falha no cadastro de produto:', { etapa: 'banco', codigo: referencia });
  if (error?.code === 'PGRST202') {
    return erroProduto('Execute o script database/produtos-vendedor.sql no Supabase para habilitar o gerenciamento de produtos.', 503);
  }
  if (error?.code === '42501') {
    return erroProduto('O banco recusou a gravação por falta de permissão. Confira as políticas de produtos, produtosImagens e a leitura dos arquivos próprios no Storage. Referência: banco/42501.', 403);
  }
  if (error?.code === '23502') {
    const coluna = String(error.message ?? '').match(/column "([a-zA-Z_][a-zA-Z0-9_]*)"/);
    return erroProduto(`O banco exige um campo que o cadastro não está preenchendo${coluna ? ': ' + coluna[1] : ''}. Referência: banco/23502.`, 400);
  }
  if (error?.code === '42804' || error?.code === '22P02') {
    return erroProduto(`Um campo do cadastro não corresponde ao tipo configurado no banco. Referência: banco/${referencia}.`, 400);
  }
  if (error?.message === 'Invalid image or storage ownership') {
    return erroProduto('O banco não conseguiu validar a foto enviada. Confira a política SELECT dos arquivos na pasta do vendedor no Storage. Referência: banco/imagem.', 400);
  }
  if (error?.code === '23503') {
    return erroProduto('A operação não pôde ser concluída: confira a categoria ou os vínculos do produto com pedidos e carrinhos.', 409);
  }
  return erroProduto(`${mensagem} Referência: banco/${referencia}.`, 502);
}

function mensagemUpload(error) {
  const status = String(error?.statusCode ?? error?.status ?? 'indisponivel');
  const referencia = /^\d{3}$/.test(status) ? status : 'indisponivel';
  console.error('Falha no cadastro de produto:', { etapa: 'storage', codigo: referencia });
  const mensagem = String(error?.message ?? '');
  if (/bucket.*not found/i.test(mensagem)) {
    return erroProduto('O bucket ImagensProdutos não foi encontrado. Confira o nome exato no Storage. Referência: storage/bucket.', 400);
  }
  if (/row.level security|permission|unauthorized/i.test(mensagem) || status === '403') {
    return erroProduto('O Storage recusou o envio. Confira a política INSERT do bucket ImagensProdutos para a pasta do vendedor. Referência: storage/permissao.', 403);
  }
  if (/mime|content.type|size|too large/i.test(mensagem) || status === '413') {
    return erroProduto('O Storage recusou o formato ou tamanho da foto. Permita JPEG, PNG e WebP de até 5 MB no bucket. Referência: storage/arquivo.', 400);
  }
  return erroProduto(`Não foi possível enviar a foto ao Storage. Referência: storage/${referencia}.`, 502);
}

export async function removerArquivosVendedor(contexto, urls) {
  const storage = contexto.cliente.storage.from(BUCKET_PRODUTOS);
  const base = storage.getPublicUrl(`${contexto.idAuth}/`).data.publicUrl;
  const caminhos = [...new Set(urls.filter(url => typeof url === 'string' && url.startsWith(base)))]
    .map(url => `${contexto.idAuth}/${decodeURIComponent(url.slice(base.length))}`);
  if (!caminhos.length) return true;
  const { error } = await storage.remove(caminhos);
  return !error;
}

export async function salvarProdutoVendedor(contexto, identificador, dados, arquivos, variacoes, remover = []) {
  const id = identificador ? validarIdProduto(identificador) : null;
  const produto = id ? await buscarProdutoVendedor(contexto, id) : null;
  const campos = validarDadosProduto(dados);
  const fotos = await validarFotos(arquivos, variacoes);
  const removerIds = (Array.isArray(remover) ? remover : [remover]).map(validarIdProduto);
  const imagensAtuais = produto?.imagens ?? [];
  if (removerIds.some(idImagem => !imagensAtuais.some(imagem => imagem.idImagem === idImagem))) {
    throw erroProduto('Não é possível remover uma imagem de outro produto.', 403);
  }
  const mantidas = imagensAtuais.filter(imagem => !removerIds.includes(imagem.idImagem));
  if (mantidas.length + fotos.length < 1 || mantidas.length + fotos.length > LIMITE_FOTOS) {
    throw erroProduto('O produto deve ter entre uma e seis fotos.');
  }
  const nomes = [...mantidas.map(imagem => imagem.nome_variacao || 'Padrão'), ...fotos.map(foto => foto.variacao)]
    .map(nome => nome.trim().toLocaleLowerCase('pt-BR'));
  if (new Set(nomes).size !== nomes.length) {
    throw erroProduto('Cada foto deve ter um nome de variação diferente.');
  }

  const categorias = await listarCategoriasVendedor(contexto);
  if (!categorias.some(categoria => categoria.id_categoria === campos.fk_categoria)) {
    throw erroProduto('A categoria selecionada não existe.');
  }

  const storage = contexto.cliente.storage.from(BUCKET_PRODUTOS);
  const enviadas = [];
  try {
    for (const foto of fotos) {
      const caminho = `${contexto.idAuth}/${randomUUID()}.${foto.extensao}`;
      const { error } = await storage.upload(caminho, foto.buffer, { contentType: foto.mime, upsert: false });
      if (error) throw mensagemUpload(error);
      enviadas.push({ caminho_arquivo: storage.getPublicUrl(caminho).data.publicUrl, nome_variacao: foto.variacao });
    }
    const { data, error } = await contexto.cliente.rpc('salvar_produto_vendedor', {
      p_produto_id: id,
      p_dados: campos,
      p_imagens: enviadas,
      p_remover_imagens: removerIds,
    });
    if (error) throw mensagemBanco(error, 'Não foi possível salvar o produto. Confira as permissões da sua empresa.');
    let limpeza = true;
    try {
      limpeza = await removerArquivosVendedor(contexto, imagensAtuais
        .filter(imagem => removerIds.includes(imagem.idImagem)).map(imagem => imagem.caminho_arquivo));
    } catch {
      limpeza = false;
    }
    return { id: data, limpeza };
  } catch (erro) {
    try {
      if (!await removerArquivosVendedor(contexto, enviadas.map(imagem => imagem.caminho_arquivo))) {
        throw new Error('Falha na limpeza');
      }
    } catch {
      throw erroProduto(`${erro.message} Alguns arquivos enviados não puderam ser removidos do Storage.`, erro.status ?? 502);
    }
    throw erro;
  }
}

export async function excluirProdutoVendedor(contexto, identificador) {
  const produto = await buscarProdutoVendedor(contexto, identificador);
  const { error } = await contexto.cliente.rpc('excluir_produto_vendedor', { p_produto_id: produto.id_produto });
  if (error) throw mensagemBanco(error, 'Não foi possível excluir o produto.');
  try {
    return await removerArquivosVendedor(contexto, produto.imagens.map(imagem => imagem.caminho_arquivo));
  } catch {
    return false;
  }
}