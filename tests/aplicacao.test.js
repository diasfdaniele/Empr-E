import testar, { before as antes, after as depois } from 'node:test';
import verificar from 'node:assert/strict';
import { readdir as listarArquivos, readFile as lerArquivo } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load as carregarHtml } from 'cheerio';
import motorEjs from 'ejs';
import aplicacao from '../src/aplicacao.js';
import {
  listarProdutos,
  buscarProduto,
  listarCategorias,
  Categoria,
} from '../src/models/produto.js';
import { listarEmpresas, Empresa } from '../src/models/empresa.js';
import { Usuario, Endereco, Contato, Favorito } from '../src/models/usuario.js';
import {
  ItemCarrinho,
  Carrinho,
  obterCarrinhoExemplo,
  ItemPedido,
  Pedido,
  Orcamento,
} from '../src/models/pedido.js';
import { Pagamento, obterPagamentoExemplo } from '../src/models/pagamento.js';
import { resumirVendas } from '../src/models/vendas.js';
import { parse as analisarCodigo, tokenizer as analisarTokens } from 'acorn';

let servidor;
let base;
antes(async () => {
  servidor = aplicacao.listen(0, '127.0.0.1');
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
depois(
  () =>
    new Promise((resolver, rejeitar) =>
      servidor.close((erro) => (erro ? rejeitar(erro) : resolver())),
    ),
);

const rotasPublicas = [
  '/',
  '/catalogo',
  '/produto/piso-tatil-alerta',
  '/produto/piso-tatil-direcional',
  '/produto/solucoes-software',
  '/carrinho',
  '/pagamento',
  '/login',
  '/cadastro',
  '/institucional',
];

testar('rotas publicas renderizam um layout compartilhado', async () => {
  for (const caminho of rotasPublicas) {
    const resposta = await fetch(base + caminho);
    verificar.equal(resposta.status, 200, caminho);
    verificar.equal(resposta.headers.get('set-cookie'), null);
    const documento = carregarHtml(await resposta.text());
    verificar.equal(documento('html').attr('lang'), 'pt-BR');
    for (const seletor of [
      'header#cabecalho',
      '#navegacao-principal',
      'main#conteudo-principal',
      'footer#rodape',
      'h1',
    ])
      verificar.equal(documento(seletor).length, 1, `${caminho} ${seletor}`);
    verificar.equal(documento('header a[href="/login"]').length, 2);
  }
});

testar('filtros, busca sem acentos e catalogo vazio', async () => {
  verificar.equal(listarProdutos({ busca: 'tatil' }).length, 2);
  verificar.equal(listarProdutos({ categoria: 'digital' }).length, 1);
  verificar.equal(listarProdutos({ empresa: 'Klinker', preco: 'ate-100' }).length, 2);
  verificar.equal(listarProdutos({ preco: '500-1000' }).length, 1);
  verificar.equal(listarProdutos({ preco: '1000-5000' }).length, 0);
  verificar.equal(listarProdutos({ busca: 'inexistente' }).length, 0);
  for (const [consulta, quantidade] of [
    ['categoria=visual', 2],
    ['busca=software', 1],
    ['preco=ate-100', 2],
    ['busca=inexistente', 0],
  ]) {
    const resposta = await fetch(`${base}/catalogo?${consulta}`);
    verificar.equal(resposta.status, 200);
    verificar.equal(carregarHtml(await resposta.text())('.produto-cartao').length, quantidade);
  }
  for (const consulta of [
    'categoria=invalida',
    'preco=constructor',
    'empresa=invalida',
    'busca=a&busca=b',
  ])
    verificar.equal((await fetch(`${base}/catalogo?${consulta}`)).status, 400);
});

testar('escape EJS impede HTML de parametros de busca', async () => {
  const entrada = '<script>alert("teste")</script>';
  const resposta = await fetch(`${base}/catalogo?busca=${encodeURIComponent(entrada)}`);
  const html = await resposta.text();
  verificar.ok(!html.includes(entrada));
  verificar.equal(carregarHtml(html)('#campo-busca').val(), entrada);
});

testar('modelos demonstrativos sao somente leitura', () => {
  const original = buscarProduto('piso-tatil-alerta');
  verificar.ok(Object.isFrozen(original));
  verificar.ok(Object.isFrozen(original.imagens));
  verificar.throws(() => {
    original.preco = 1;
  }, TypeError);
  listarProdutos().pop();
  verificar.equal(listarProdutos().length, 3);
  verificar.equal(buscarProduto('inexistente'), undefined);
});

testar('areas restritas nao renderizam paineis nem aceitam operacoes', async () => {
  for (const caminho of [
    '/conta',
    '/conta/vendedor',
    '/conta/admin',
    '/conta/favoritos',
    '/conta/pedidos',
  ]) {
    const resposta = await fetch(base + caminho);
    verificar.equal(resposta.status, 503);
    const documento = carregarHtml(await resposta.text());
    verificar.match(documento('h1').text(), /indisponível/);
    verificar.equal(
      documento('#conta-administracao-painel, #conta-vendedor-painel, form').length,
      0,
    );
  }
  for (const caminho of ['/login', '/cadastro', '/pagamento', '/conta/admin', '/pedidos'])
    verificar.equal(
      (await fetch(base + caminho, { method: 'POST', body: 'email=teste&senha=teste' })).status,
      404,
    );
});

testar('formularios pessoais indisponiveis e checkout sem QR', async () => {
  for (const caminho of ['/cadastro', '/login', '/pagamento']) {
    const documento = carregarHtml(await (await fetch(base + caminho)).text());
    documento('input, textarea').each((indice, elemento) =>
      verificar.ok(documento(elemento).is('[disabled]'), `${caminho}: campo pessoal ativo`),
    );
    documento('form').each((indice, elemento) =>
      verificar.ok(documento(elemento).is('[data-formulario-desabilitado]')),
    );
    verificar.equal(documento('form[action], form[method=post]').length, 0);
    verificar.equal(documento('button[type=submit]:not([disabled])').length, 0);
    verificar.equal(documento('#pix-qr-image, #painel-cartao').length, 0);
  }
});

testar('links, ancoras e assets locais existem; legado nao e publico', async () => {
  const visitados = new Map();
  for (const caminho of rotasPublicas) {
    const documento = carregarHtml(await (await fetch(base + caminho)).text());
    for (const elemento of documento('[href], [src]').toArray()) {
      const valor = documento(elemento).attr('href') || documento(elemento).attr('src');
      if (!valor.startsWith('/') && !valor.startsWith('#')) continue;
      const destino = new URL(valor, base + caminho);
      if (!visitados.has(destino.pathname + destino.search)) {
        const resposta = await fetch(destino);
        verificar.ok(
          [200, 503].includes(resposta.status),
          `${caminho} -> ${valor}: ${resposta.status}`,
        );
        visitados.set(destino.pathname + destino.search, await resposta.text());
      }
      if (destino.hash) {
        const documentoDestino = carregarHtml(visitados.get(destino.pathname + destino.search));
        verificar.equal(
          documentoDestino('[id]')
            .toArray()
            .some((no) => no.attribs.id === decodeURIComponent(destino.hash.slice(1))),
          true,
          `Ancora ausente: ${valor}`,
        );
      }
      verificar.ok(!valor.includes('.html'), valor);
    }
  }
  for (const caminho of [
    '/firebase.json',
    '/bancoSQL/0-bancoDeDados_tables.sql',
    '/src/views/restritas/administracao.ejs',
    '/assets/js/firebase.js',
    '/produto/inexistente',
  ])
    verificar.equal((await fetch(base + caminho)).status, 404);
});

testar('fontes da aplicacao sem SDK, persistencia ou credenciais legadas', async () => {
  async function inspecionar(pasta) {
    for (const entrada of await listarArquivos(pasta, { withFileTypes: true })) {
      const caminho = `${pasta}/${entrada.name}`;
      if (entrada.isDirectory()) await inspecionar(caminho);
      else if (/\.(js|ejs|json)$/.test(entrada.name)) {
        const texto = await lerArquivo(caminho, 'utf8');
        verificar.ok(
          !/firebase|firestore|localStorage|sessionStorage|apiKey|adminPassword|qrserver/i.test(
            texto,
          ),
          caminho,
        );
      }
    }
  }
  await inspecionar(fileURLToPath(new URL('../src/', import.meta.url)));
  await inspecionar(fileURLToPath(new URL('../public/assets/js/', import.meta.url)));
  const manifesto = JSON.parse(
    await lerArquivo(new URL('../package.json', import.meta.url), 'utf8'),
  );
  verificar.ok(
    !Object.keys(manifesto.dependencies).some((nome) =>
      /firebase|mysql|sqlite|sequelize|prisma|mongoose/.test(nome),
    ),
  );
});

testar('entidades PF/PJ e papeis comerciais distintos', () => {
  verificar.ok(listarCategorias().every((categoria) => categoria instanceof Categoria));
  verificar.ok(listarEmpresas().every((empresa) => empresa instanceof Empresa));
  verificar.equal(
    new Usuario({ id: 'pf-exemplo', tipoPessoa: 'pf', papel: 'comprador' }).podeVender,
    false,
  );
  verificar.equal(
    new Usuario({ id: 'pj-exemplo', tipoPessoa: 'pj', papel: 'comprador' }).podeVender,
    false,
  );
  verificar.equal(
    new Usuario({
      id: 'vendedor-exemplo',
      tipoPessoa: 'pj',
      papel: 'vendedor',
      empresaId: 'klinker',
    }).podeVender,
    true,
  );
  verificar.throws(() => new Usuario({ id: 'pf', tipoPessoa: 'pf', papel: 'vendedor' }), TypeError);
  verificar.throws(() => new Usuario({ id: 'pj', tipoPessoa: 'pj', papel: 'vendedor' }), TypeError);
  verificar.throws(
    () => new Usuario({ id: 'usuario', tipoPessoa: 'invalido', papel: 'comprador' }),
    TypeError,
  );
});

testar('carrinho e itens possuem contratos e totais proprios', () => {
  const carrinho = obterCarrinhoExemplo();
  verificar.ok(carrinho instanceof Carrinho);
  verificar.ok(carrinho.itens.every((item) => item instanceof ItemCarrinho));
  verificar.equal(carrinho.quantidade, 5);
  verificar.equal(carrinho.total, 100);
  verificar.equal(carrinho.itens[2].total, 0);
  verificar.ok(Object.isFrozen(carrinho.itens));
  verificar.throws(() => carrinho.itens.push(carrinho.itens[0]), TypeError);
  verificar.throws(
    () =>
      new ItemCarrinho({
        produtoId: 'produto',
        quantidade: 0,
        precoUnitario: 25,
        modalidade: 'compra',
      }),
    TypeError,
  );
  verificar.throws(() => new Carrinho({ id: 'carrinho', itens: [{}] }), TypeError);
  const centavos = new ItemCarrinho({
    produtoId: 'produto',
    quantidade: 3,
    precoUnitario: 0.1,
    modalidade: 'compra',
  });
  verificar.equal(centavos.total, 0.3);
});

testar('pedidos, itens, pagamentos e orcamentos sem gravacao', () => {
  const item = new ItemPedido({ produtoId: 'produto-exemplo', quantidade: 3, precoUnitario: 0.1 });
  const pedido = new Pedido({
    id: 'pedido-exemplo',
    compradorId: 'comprador-exemplo',
    enderecoId: 'endereco-exemplo',
    itens: [item],
  });
  verificar.equal(pedido.total, 0.3);
  verificar.ok(Object.isFrozen(pedido));
  verificar.ok(Object.isFrozen(pedido.itens));
  verificar.throws(
    () => new Pedido({ id: 'pedido', compradorId: 'comprador', enderecoId: 'endereco', itens: [] }),
    TypeError,
  );
  verificar.throws(
    () => new ItemPedido({ produtoId: 'produto', quantidade: 1, precoUnitario: -1 }),
    TypeError,
  );
  verificar.throws(
    () => new ItemPedido({ produtoId: 'produto', quantidade: 1, precoUnitario: 0.001 }),
    TypeError,
  );
  const pagamento = new Pagamento({
    id: 'pagamento-exemplo',
    pedidoId: pedido.id,
    metodo: 'pix',
    valor: pedido.total,
  });
  verificar.equal(pagamento.pedidoId, pedido.id);
  verificar.ok(Object.isFrozen(pagamento));
  verificar.equal(obterPagamentoExemplo().total, 50);
  const orcamento = new Orcamento({
    id: 'orcamento-exemplo',
    compradorId: 'comprador-exemplo',
    produtoId: 'solucoes-software',
    quantidade: 1,
    descricao: 'Projeto fictício',
  });
  verificar.ok(Object.isFrozen(orcamento));
});

testar('enderecos, contatos e favoritos pertencem a usuarios PF ou PJ', () => {
  const endereco = new Endereco({
    id: 'endereco-exemplo',
    usuarioId: 'pf-exemplo',
    tipo: 'entrega',
    cep: '01001000',
    logradouro: 'Praça de exemplo',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
  });
  const contato = new Contato({
    id: 'contato-exemplo',
    usuarioId: endereco.usuarioId,
    tipo: 'email',
    valor: 'exemplo@example.invalid',
  });
  const favorito = new Favorito({ usuarioId: endereco.usuarioId, produtoId: 'piso-tatil-alerta' });
  verificar.equal(contato.usuarioId, favorito.usuarioId);
  verificar.ok([endereco, contato, favorito].every(Object.isFrozen));
  verificar.throws(
    () => new Contato({ id: 'contato', usuarioId: 'usuario', tipo: 'invalido', valor: 'exemplo' }),
    TypeError,
  );
  verificar.throws(() => new Favorito({ usuarioId: '', produtoId: 'produto' }), TypeError);
});

testar('seis modulos de dominio com nomes em portugues', async () => {
  const modulos = ['empresa', 'pagamento', 'pedido', 'produto', 'usuario', 'vendas'];
  verificar.deepEqual(
    (await listarArquivos(new URL('../src/models/', import.meta.url))).sort(),
    modulos.map((nome) => `${nome}.js`),
  );
  verificar.deepEqual(
    (await listarArquivos(new URL('../src/controllers/', import.meta.url))).sort(),
    [...modulos, 'paginas'].map((nome) => `${nome}.js`).sort(),
  );
  for (const nome of modulos) {
    const modelo = await import(`../src/models/${nome}.js`);
    const controlador = await import(`../src/controllers/${nome}.js`);
    verificar.ok(
      Object.values(modelo).some((valor) => typeof valor === 'function'),
      `${nome}: model sem contrato`,
    );
    verificar.ok(
      Object.values(controlador).some((valor) => typeof valor === 'function'),
      `${nome}: controller sem ação`,
    );
  }
});

testar('vendas sao derivadas de pedidos confirmados sem duplicar registros', () => {
  const itens = [
    new ItemPedido({ produtoId: 'piso-tatil-alerta', quantidade: 2, precoUnitario: 25 }),
    new ItemPedido({ produtoId: 'solucoes-software', quantidade: 1, precoUnitario: 1000 }),
  ];
  const confirmado = new Pedido({
    id: 'pedido-pago',
    compradorId: 'comprador',
    enderecoId: 'endereco',
    situacao: 'pago',
    itens,
  });
  const aberto = new Pedido({
    id: 'pedido-aberto',
    compradorId: 'comprador',
    enderecoId: 'endereco',
    itens,
  });
  const cancelado = new Pedido({
    id: 'pedido-cancelado',
    compradorId: 'comprador',
    enderecoId: 'endereco',
    situacao: 'cancelado',
    itens,
  });
  verificar.deepEqual(resumirVendas([confirmado, aberto, cancelado], 'klinker'), {
    quantidadePedidos: 1,
    quantidadeItens: 2,
    total: 50,
  });
  verificar.deepEqual(resumirVendas([confirmado], 'acessify'), {
    quantidadePedidos: 1,
    quantidadeItens: 1,
    total: 1000,
  });
  verificar.deepEqual(resumirVendas([confirmado]), {
    quantidadePedidos: 1,
    quantidadeItens: 3,
    total: 1050,
  });
  verificar.deepEqual(resumirVendas([]), { quantidadePedidos: 0, quantidadeItens: 0, total: 0 });
  verificar.ok(Object.isFrozen(resumirVendas([confirmado])));
  verificar.throws(() => resumirVendas([{}]), TypeError);
  verificar.throws(() => resumirVendas([confirmado], 'empresa-inexistente'), TypeError);
});

testar('paineis restritos reutilizam templates sem duplicacao', async () => {
  const caminho = fileURLToPath(new URL('../src/views/restritas/conta.ejs', import.meta.url));
  const fonte = await lerArquivo(caminho, 'utf8');
  verificar.ok(fonte.includes('include("administracao")'));
  verificar.ok(fonte.includes('include("vendedor")'));
  verificar.ok(!fonte.includes('id="conta-admin-painel"'));
  verificar.ok(!fonte.includes('id="conta-vendedor-painel"'));
  const documento = carregarHtml(await motorEjs.renderFile(caminho, {}));
  verificar.equal(documento('#conta-administracao-painel').length, 1);
  verificar.equal(documento('#conta-vendedor-painel').length, 1);
});

testar('dados e identificadores proprios usam portugues sem adaptador legado', async () => {
  const proibidos = new Set([
    'apresentarProduto',
    'product',
    'products',
    'categoryLabel',
    'categories',
    'companies',
    'filters',
    'money',
    'heading',
    'message',
    'menuButton',
    'fontSize',
    'updateCart',
    'cartList',
    'postalButton',
    'notificationTimer',
    'additions',
    'announce',
    'setMenu',
  ]);
  async function conferir(pasta) {
    for (const entrada of await listarArquivos(pasta, { withFileTypes: true })) {
      const caminho = `${pasta}/${entrada.name}`;
      if (entrada.isDirectory()) await conferir(caminho);
      else if (entrada.name.endsWith('.js')) {
        const arvore = analisarCodigo(await lerArquivo(caminho, 'utf8'), {
          ecmaVersion: 'latest',
          sourceType: 'module',
        });
        function percorrer(no, pai) {
          if (!no || typeof no !== 'object') return;
          if (Array.isArray(no)) {
            no.forEach((filho) => percorrer(filho, pai));
            return;
          }
          const mensagemErro =
            no.name === 'message' && pai?.type === 'MemberExpression' && pai.object.name === 'erro';
          if (no.type === 'Identifier' && !mensagemErro)
            verificar.ok(!proibidos.has(no.name), `${caminho}: ${no.name}`);
          for (const [chave, filho] of Object.entries(no))
            if (!['start', 'end', 'loc'].includes(chave)) percorrer(filho, no);
        }
        percorrer(arvore);
      } else if (entrada.name.endsWith('.ejs')) {
        const texto = await lerArquivo(caminho, 'utf8');
        for (const bloco of texto.matchAll(/<%[=-]?([\s\S]*?)%>/g)) {
          for (const token of analisarTokens(bloco[1], { ecmaVersion: 'latest' })) {
            if (token.type.label === 'name')
              verificar.ok(!proibidos.has(token.value), `${caminho}: ${token.value}`);
          }
        }
      }
    }
  }
  await conferir(fileURLToPath(new URL('../src/', import.meta.url)));
  await conferir(fileURLToPath(new URL('../public/assets/js/', import.meta.url)));
});
