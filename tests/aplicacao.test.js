import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import ejs from 'ejs';
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
import { parse, tokenizer } from 'acorn';

let server;
let baseUrl;
before(async () => {
  server = aplicacao.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(
  () =>
    new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
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

test('rotas publicas renderizam um layout compartilhado', async () => {
  for (const caminho of rotasPublicas) {
    const response = await fetch(baseUrl + caminho);
    assert.equal(response.status, 200, caminho);
    assert.equal(response.headers.get('set-cookie'), null);
    const documento = load(await response.text());
    assert.equal(documento('html').attr('lang'), 'pt-BR');
    for (const seletor of [
      'header#cabecalho',
      '#navegacao-principal',
      'main#conteudo-principal',
      'footer#rodape',
      'h1',
    ])
      assert.equal(documento(seletor).length, 1, `${caminho} ${seletor}`);
    assert.equal(documento('header a[href="/login"]').length, 2);
  }
});

test('filtros, busca sem acentos e catalogo vazio', async () => {
  assert.equal(listarProdutos({ busca: 'tatil' }).length, 2);
  assert.equal(listarProdutos({ categoria: 'digital' }).length, 1);
  assert.equal(listarProdutos({ empresa: 'Klinker', preco: 'ate-100' }).length, 2);
  assert.equal(listarProdutos({ preco: '500-1000' }).length, 1);
  assert.equal(listarProdutos({ preco: '1000-5000' }).length, 0);
  assert.equal(listarProdutos({ busca: 'inexistente' }).length, 0);
  for (const [consulta, quantidade] of [
    ['categoria=visual', 2],
    ['busca=software', 1],
    ['preco=ate-100', 2],
    ['busca=inexistente', 0],
  ]) {
    const response = await fetch(`${baseUrl}/catalogo?${consulta}`);
    assert.equal(response.status, 200);
    assert.equal(load(await response.text())('.produto-cartao').length, quantidade);
  }
  for (const consulta of [
    'categoria=invalida',
    'preco=constructor',
    'empresa=invalida',
    'busca=a&busca=b',
  ])
    assert.equal((await fetch(`${baseUrl}/catalogo?${consulta}`)).status, 400);
});

test('escape EJS impede HTML de parametros de busca', async () => {
  const entrada = '<script>alert("teste")</script>';
  const response = await fetch(`${baseUrl}/catalogo?busca=${encodeURIComponent(entrada)}`);
  const html = await response.text();
  assert.ok(!html.includes(entrada));
  assert.equal(load(html)('#campo-busca').val(), entrada);
});

test('modelos demonstrativos sao somente leitura', () => {
  const original = buscarProduto('piso-tatil-alerta');
  assert.ok(Object.isFrozen(original));
  assert.ok(Object.isFrozen(original.imagens));
  assert.throws(() => {
    original.preco = 1;
  }, TypeError);
  listarProdutos().pop();
  assert.equal(listarProdutos().length, 3);
  assert.equal(buscarProduto('inexistente'), undefined);
});

test('areas restritas nao renderizam paineis nem aceitam operacoes', async () => {
  for (const caminho of [
    '/conta',
    '/conta/vendedor',
    '/conta/admin',
    '/conta/favoritos',
    '/conta/pedidos',
  ]) {
    const response = await fetch(baseUrl + caminho);
    assert.equal(response.status, 503);
    const documento = load(await response.text());
    assert.match(documento('h1').text(), /indisponível/);
    assert.equal(
      documento('#conta-administracao-painel, #conta-vendedor-painel, form').length,
      0,
    );
  }
  for (const caminho of ['/login', '/cadastro', '/pagamento', '/conta/admin', '/pedidos'])
    assert.equal(
      (await fetch(baseUrl + caminho, { method: 'POST', body: 'email=teste&senha=teste' })).status,
      404,
    );
});

test('formularios pessoais indisponiveis e checkout sem QR', async () => {
  for (const caminho of ['/cadastro', '/login', '/pagamento']) {
    const documento = load(await (await fetch(baseUrl + caminho)).text());
    documento('input, textarea').each((indice, elemento) =>
      assert.ok(documento(elemento).is('[disabled]'), `${caminho}: campo pessoal ativo`),
    );
    documento('form').each((indice, elemento) =>
      assert.ok(documento(elemento).is('[data-formulario-desabilitado]')),
    );
    assert.equal(documento('form[action], form[method=post]').length, 0);
    assert.equal(documento('button[type=submit]:not([disabled])').length, 0);
    assert.equal(documento('#pix-qr-image, #painel-cartao').length, 0);
  }
});

test('links, ancoras e assets locais existem; legado nao e publico', async () => {
  const visitados = new Map();
  for (const caminho of rotasPublicas) {
    const documento = load(await (await fetch(baseUrl + caminho)).text());
    for (const elemento of documento('[href], [src]').toArray()) {
      const valor = documento(elemento).attr('href') || documento(elemento).attr('src');
      if (!valor.startsWith('/') && !valor.startsWith('#')) continue;
      const destino = new URL(valor, baseUrl + caminho);
      if (!visitados.has(destino.pathname + destino.search)) {
        const response = await fetch(destino);
        assert.ok(
          [200, 503].includes(response.status),
          `${caminho} -> ${valor}: ${response.status}`,
        );
        visitados.set(destino.pathname + destino.search, await response.text());
      }
      if (destino.hash) {
        const documentoDestino = load(visitados.get(destino.pathname + destino.search));
        assert.equal(
          documentoDestino('[id]')
            .toArray()
            .some((no) => no.attribs.id === decodeURIComponent(destino.hash.slice(1))),
          true,
          `Ancora ausente: ${valor}`,
        );
      }
      assert.ok(!valor.includes('.html'), valor);
    }
  }
  for (const caminho of [
    '/firebase.json',
    '/bancoSQL/0-bancoDeDados_tables.sql',
    '/src/views/restritas/administracao.ejs',
    '/assets/js/firebase.js',
    '/produto/inexistente',
  ])
    assert.equal((await fetch(baseUrl + caminho)).status, 404);
});

test('fontes da aplicacao sem SDK, persistencia ou credenciais legadas', async () => {
  async function inspecionar(pasta) {
    for (const entrada of await readdir(pasta, { withFileTypes: true })) {
      const caminho = `${pasta}/${entrada.name}`;
      if (entrada.isDirectory()) await inspecionar(caminho);
      else if (/\.(js|ejs|json)$/.test(entrada.name)) {
        const texto = await readFile(caminho, 'utf8');
        assert.ok(
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
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.ok(
    !Object.keys(manifesto.dependencies).some((nome) =>
      /firebase|mysql|sqlite|sequelize|prisma|mongoose/.test(nome),
    ),
  );
});

test('entidades PF/PJ e papeis comerciais distintos', () => {
  assert.ok(listarCategorias().every((categoria) => categoria instanceof Categoria));
  assert.ok(listarEmpresas().every((empresa) => empresa instanceof Empresa));
  assert.equal(
    new Usuario({ id: 'pf-exemplo', tipoPessoa: 'pf', papel: 'comprador' }).podeVender,
    false,
  );
  assert.equal(
    new Usuario({ id: 'pj-exemplo', tipoPessoa: 'pj', papel: 'comprador' }).podeVender,
    false,
  );
  assert.equal(
    new Usuario({
      id: 'vendedor-exemplo',
      tipoPessoa: 'pj',
      papel: 'vendedor',
      empresaId: 'klinker',
    }).podeVender,
    true,
  );
  assert.throws(() => new Usuario({ id: 'pf', tipoPessoa: 'pf', papel: 'vendedor' }), TypeError);
  assert.throws(() => new Usuario({ id: 'pj', tipoPessoa: 'pj', papel: 'vendedor' }), TypeError);
  assert.throws(
    () => new Usuario({ id: 'usuario', tipoPessoa: 'invalido', papel: 'comprador' }),
    TypeError,
  );
});

test('carrinho e itens possuem contratos e totais proprios', () => {
  const carrinho = obterCarrinhoExemplo();
  assert.ok(carrinho instanceof Carrinho);
  assert.ok(carrinho.itens.every((item) => item instanceof ItemCarrinho));
  assert.equal(carrinho.quantidade, 5);
  assert.equal(carrinho.total, 100);
  assert.equal(carrinho.itens[2].total, 0);
  assert.ok(Object.isFrozen(carrinho.itens));
  assert.throws(() => carrinho.itens.push(carrinho.itens[0]), TypeError);
  assert.throws(
    () =>
      new ItemCarrinho({
        produtoId: 'produto',
        quantidade: 0,
        precoUnitario: 25,
        modalidade: 'compra',
      }),
    TypeError,
  );
  assert.throws(() => new Carrinho({ id: 'carrinho', itens: [{}] }), TypeError);
  const centavos = new ItemCarrinho({
    produtoId: 'produto',
    quantidade: 3,
    precoUnitario: 0.1,
    modalidade: 'compra',
  });
  assert.equal(centavos.total, 0.3);
});

test('pedidos, itens, pagamentos e orcamentos sem gravacao', () => {
  const item = new ItemPedido({ produtoId: 'produto-exemplo', quantidade: 3, precoUnitario: 0.1 });
  const pedido = new Pedido({
    id: 'pedido-exemplo',
    compradorId: 'comprador-exemplo',
    enderecoId: 'endereco-exemplo',
    itens: [item],
  });
  assert.equal(pedido.total, 0.3);
  assert.ok(Object.isFrozen(pedido));
  assert.ok(Object.isFrozen(pedido.itens));
  assert.throws(
    () => new Pedido({ id: 'pedido', compradorId: 'comprador', enderecoId: 'endereco', itens: [] }),
    TypeError,
  );
  assert.throws(
    () => new ItemPedido({ produtoId: 'produto', quantidade: 1, precoUnitario: -1 }),
    TypeError,
  );
  assert.throws(
    () => new ItemPedido({ produtoId: 'produto', quantidade: 1, precoUnitario: 0.001 }),
    TypeError,
  );
  const pagamento = new Pagamento({
    id: 'pagamento-exemplo',
    pedidoId: pedido.id,
    metodo: 'pix',
    valor: pedido.total,
  });
  assert.equal(pagamento.pedidoId, pedido.id);
  assert.ok(Object.isFrozen(pagamento));
  assert.equal(obterPagamentoExemplo().total, 50);
  const orcamento = new Orcamento({
    id: 'orcamento-exemplo',
    compradorId: 'comprador-exemplo',
    produtoId: 'solucoes-software',
    quantidade: 1,
    descricao: 'Projeto fictício',
  });
  assert.ok(Object.isFrozen(orcamento));
});

test('enderecos, contatos e favoritos pertencem a usuarios PF ou PJ', () => {
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
  assert.equal(contato.usuarioId, favorito.usuarioId);
  assert.ok([endereco, contato, favorito].every(Object.isFrozen));
  assert.throws(
    () => new Contato({ id: 'contato', usuarioId: 'usuario', tipo: 'invalido', valor: 'exemplo' }),
    TypeError,
  );
  assert.throws(() => new Favorito({ usuarioId: '', produtoId: 'produto' }), TypeError);
});

test('seis modulos de dominio com nomes em portugues', async () => {
  const modulos = ['empresa', 'pagamento', 'pedido', 'produto', 'usuario', 'vendas'];
  assert.deepEqual(
    (await readdir(new URL('../src/models/', import.meta.url))).sort(),
    modulos.map((nome) => `${nome}.js`),
  );
  assert.deepEqual(
    (await readdir(new URL('../src/controllers/', import.meta.url))).sort(),
    [...modulos, 'paginas'].map((nome) => `${nome}.js`).sort(),
  );
  for (const nome of modulos) {
    const modelo = await import(`../src/models/${nome}.js`);
    const controlador = await import(`../src/controllers/${nome}.js`);
    assert.ok(
      Object.values(modelo).some((valor) => typeof valor === 'function'),
      `${nome}: model sem contrato`,
    );
    assert.ok(
      Object.values(controlador).some((valor) => typeof valor === 'function'),
      `${nome}: controller sem ação`,
    );
  }
});

test('vendas sao derivadas de pedidos confirmados sem duplicar registros', () => {
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
  assert.deepEqual(resumirVendas([confirmado, aberto, cancelado], 'klinker'), {
    quantidadePedidos: 1,
    quantidadeItens: 2,
    total: 50,
  });
  assert.deepEqual(resumirVendas([confirmado], 'acessify'), {
    quantidadePedidos: 1,
    quantidadeItens: 1,
    total: 1000,
  });
  assert.deepEqual(resumirVendas([confirmado]), {
    quantidadePedidos: 1,
    quantidadeItens: 3,
    total: 1050,
  });
  assert.deepEqual(resumirVendas([]), { quantidadePedidos: 0, quantidadeItens: 0, total: 0 });
  assert.ok(Object.isFrozen(resumirVendas([confirmado])));
  assert.throws(() => resumirVendas([{}]), TypeError);
  assert.throws(() => resumirVendas([confirmado], 'empresa-inexistente'), TypeError);
});

test('paineis restritos reutilizam templates sem duplicacao', async () => {
  const caminho = fileURLToPath(new URL('../src/views/restritas/conta.ejs', import.meta.url));
  const fonte = await readFile(caminho, 'utf8');
  assert.ok(fonte.includes('include("administracao")'));
  assert.ok(fonte.includes('include("vendedor")'));
  assert.ok(!fonte.includes('id="conta-admin-painel"'));
  assert.ok(!fonte.includes('id="conta-vendedor-painel"'));
  const documento = load(await ejs.renderFile(caminho, {}));
  assert.equal(documento('#conta-administracao-painel').length, 1);
  assert.equal(documento('#conta-vendedor-painel').length, 1);
});

test('dados e identificadores proprios usam portugues sem adaptador legado', async () => {
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
    for (const entrada of await readdir(pasta, { withFileTypes: true })) {
      const caminho = `${pasta}/${entrada.name}`;
      if (entrada.isDirectory()) await conferir(caminho);
      else if (entrada.name.endsWith('.js')) {
        const arvore = parse(await readFile(caminho, 'utf8'), {
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
            no.name === 'message' &&
            pai?.type === 'MemberExpression' &&
            ['erro', 'err'].includes(pai.object.name);
          if (no.type === 'Identifier' && !mensagemErro)
            assert.ok(!proibidos.has(no.name), `${caminho}: ${no.name}`);
          for (const [chave, filho] of Object.entries(no))
            if (!['start', 'end', 'loc'].includes(chave)) percorrer(filho, no);
        }
        percorrer(arvore);
      } else if (entrada.name.endsWith('.ejs')) {
        const texto = await readFile(caminho, 'utf8');
        for (const bloco of texto.matchAll(/<%[=-]?([\s\S]*?)%>/g)) {
          for (const token of tokenizer(bloco[1], { ecmaVersion: 'latest' })) {
            if (token.type.label === 'name')
              assert.ok(!proibidos.has(token.value), `${caminho}: ${token.value}`);
          }
        }
      }
    }
  }
  await conferir(fileURLToPath(new URL('../src/', import.meta.url)));
  await conferir(fileURLToPath(new URL('../public/assets/js/', import.meta.url)));
});
