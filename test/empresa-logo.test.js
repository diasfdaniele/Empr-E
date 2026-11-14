import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import {
  BUCKET_EMPRESAS,
  cadastrarUsuario,
  validarLogoEmpresa,
  LIMITE_LOGO_EMPRESA,
} from '../src/services/autenticacao.js';
import { listarEmpresasVendedoras, selecionarEmpresasDestaque } from '../src/models/empresa.js';

test('logo aceita somente imagens JPEG, PNG ou WebP de até 5 MB', async () => {
  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  const logo = await validarLogoEmpresa({ buffer, size: buffer.length });
  assert.equal(logo.mime, 'image/jpeg');
  assert.equal(logo.extensao, 'jpg');
  assert.equal(await validarLogoEmpresa(null), null);

  await assert.rejects(
    validarLogoEmpresa({ buffer: Buffer.from('<svg></svg>'), size: 11 }),
    /JPEG, PNG ou WebP/
  );
  await assert.rejects(
    validarLogoEmpresa({ buffer, size: LIMITE_LOGO_EMPRESA + 1 }),
    /no máximo 5 MB/
  );
});

test('cadastro salva a URL da logo na empresa usando o bucket próprio', async (t) => {
  const anteriores = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://cadastro-logo-teste.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'chave-publicavel-de-teste';
  t.after(() => {
    for (const [nome, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  const idAuth = '00000000-0000-0000-0000-000000000001';
  const usuario = { id_usuario: 1, id_auth: idAuth, tipo_pessoa: 'pj', nome_completo: 'Pessoa teste' };
  let empresaRecebida;
  let caminhoEnviado;
  t.mock.method(globalThis, 'fetch', async (entrada, opcoes) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url ?? entrada.toString());
    let resposta;
    if (url.pathname === '/auth/v1/signup') {
      const payload = Buffer.from(JSON.stringify({
        sub: idAuth,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url');
      resposta = {
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.assinatura-teste`,
        refresh_token: 'refresh-teste',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: idAuth },
      };
    } else if (url.pathname === '/rest/v1/usuarios') {
      resposta = usuario;
    } else if (url.pathname.startsWith(`/storage/v1/object/${BUCKET_EMPRESAS}/`)) {
      caminhoEnviado = url.pathname;
      resposta = { Key: url.pathname };
    } else if (url.pathname === '/rest/v1/empresas') {
      empresaRecebida = JSON.parse(opcoes.body);
      resposta = { ...empresaRecebida, id_empresa: 1 };
    } else {
      assert.fail(`Requisição inesperada: ${url.pathname}`);
    }
    return new Response(JSON.stringify(resposta), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  const resultado = await cadastrarUsuario({
    email: 'vendedor@example.com',
    senha: 'senha-de-teste',
    confirmarSenha: 'senha-de-teste',
    tipoPessoa: 'pj',
    perfilComercial: 'vendedor',
    nomeCompleto: 'Pessoa teste',
    cpfPessoa: '12345678901',
    cnpj: '12345678000199',
    razaoSocial: 'Empresa teste',
    nomeFantasia: 'Empresa teste',
  }, { buffer, size: buffer.length });

  assert.match(caminhoEnviado, new RegExp(`/storage/v1/object/${BUCKET_EMPRESAS}/${idAuth}/`));
  assert.match(caminhoEnviado, /\.jpg$/);
  assert.match(empresaRecebida.logo_url, new RegExp(`/storage/v1/object/public/${BUCKET_EMPRESAS}/${idAuth}/`));
  assert.equal(resultado.empresa.logo_url, empresaRecebida.logo_url);
  assert.equal(resultado.avisoLogo, null);
});

test('listagem consulta a view pública e inclui empresas cadastradas no banco', async () => {
  let tabela;
  let campos;
  let ordenacao;
  const resultado = [
    { id_empresa: 4, nome_fantasia: 'Acessibilidade A', logo_url: 'https://exemplo/logo-a.png', categoria_empresa: 'Digital' },
    { id_empresa: 9, nome_fantasia: 'Empresa B', logo_url: null, categoria_empresa: null },
  ];
  const consulta = {
    select(valor) { campos = valor; return this; },
    order(...argumentos) { ordenacao = argumentos; return this; },
    then(resolve, reject) { return Promise.resolve({ data: resultado, error: null }).then(resolve, reject); },
  };
  const cliente = { from(valor) { tabela = valor; return consulta; } };

  const empresas = await listarEmpresasVendedoras(cliente);
  assert.equal(tabela, 'empresas_publicas');
  assert.equal(campos, 'id_empresa, nome_fantasia, logo_url, categoria_empresa');
  assert.deepEqual(ordenacao, ['nome_fantasia', { ascending: true }]);
  assert.deepEqual(empresas, [
    { id: 4, nomeFantasia: 'Acessibilidade A', logoUrl: 'https://exemplo/logo-a.png', categoriaEmpresa: 'Digital' },
    { id: 9, nomeFantasia: 'Empresa B', logoUrl: null, categoriaEmpresa: 'Setor não informado' },
  ]);
});

test('página de empresas renderiza logo cadastrada ou inicial como fallback', async () => {
  const arquivo = fileURLToPath(new URL('../src/views/paginas/empresas.ejs', import.meta.url));
  const html = await ejs.renderFile(arquivo, {
    empresas: [
      { id: 4, nomeFantasia: 'Acessibilidade A', logoUrl: 'https://exemplo/logo-a.png', categoriaEmpresa: 'Digital' },
      { id: 9, nomeFantasia: 'Empresa B', logoUrl: null, categoriaEmpresa: 'Mobilidade' },
    ],
    setores: ['Digital', 'Mobilidade'],
  });

  assert.match(html, /src="https:\/\/exemplo\/logo-a\.png"/);
  assert.match(html, /Logo da empresa Acessibilidade A/);
  assert.match(html, /Empresa B/);
  assert.match(html, />\s*E\s*</);
  assert.match(html, /\/catalogo\?empresa=Acessibilidade%20A/);
  assert.match(html, /2 empresas encontradas/);
  assert.match(html, /id="empresa-busca"/);
  assert.match(html, /id="empresa-setor"/);
  assert.match(html, /value="Digital">Digital/);
  assert.match(html, /id="empresa-ordenacao"/);
  assert.match(html, /data-setor="Digital"/);
});

test('filtros de nome e setor e ordenação atualizam os cartões e a contagem', async () => {
  const dados = [
    { nome: 'Beta', setor: 'Digital' },
    { nome: 'Ação', setor: 'Mobilidade' },
    { nome: 'Alpha', setor: 'Digital' },
  ];
  const eventos = {};
  const formulario = {
    addEventListener(tipo, callback) { eventos[tipo] = callback; },
  };
  const busca = { value: '' };
  const setor = { value: '' };
  const ordenacao = { value: 'az' };
  const resultado = { textContent: '' };
  const semResultados = { hidden: true };
  const cartoes = dados.map(({ nome, setor: setorEmpresa }) => ({
    dataset: { nome, setor: setorEmpresa },
    classes: new Set(),
    classList: {
      toggle(classe, ativo) {
        if (ativo) this.cartao.classes.add(classe);
        else this.cartao.classes.delete(classe);
      },
    },
  }));
  for (const cartao of cartoes) cartao.classList.cartao = cartao;
  const grade = {
    filhos: [...cartoes],
    querySelectorAll() { return cartoes; },
    append(cartao) {
      this.filhos = this.filhos.filter((item) => item !== cartao);
      this.filhos.push(cartao);
    },
  };
  const elementos = {
    'filtros-empresas': formulario,
    'empresa-busca': busca,
    'empresa-setor': setor,
    'empresa-ordenacao': ordenacao,
    'empresas-grade': grade,
    'empresas-resultado': resultado,
    'empresas-sem-resultados': semResultados,
  };
  const documento = {
    addEventListener(_tipo, callback) { this.iniciar = callback; },
    getElementById(id) { return elementos[id]; },
  };
  const codigo = await readFile(new URL('../public/assets/js/empresas.js', import.meta.url), 'utf8');

  runInNewContext(codigo, {
    document: documento,
    setTimeout: (callback) => callback(),
  });
  documento.iniciar();

  assert.deepEqual(grade.filhos.map((cartao) => cartao.dataset.nome), ['Ação', 'Alpha', 'Beta']);
  busca.value = 'acao';
  eventos.input();
  assert.equal(grade.filhos.find((cartao) => cartao.dataset.nome === 'Ação').classes.has('empresa-cartao--oculta'), false);
  assert.equal(resultado.textContent, '1 empresa encontrada');

  busca.value = '';
  setor.value = 'Digital';
  eventos.change();
  assert.equal(resultado.textContent, '2 empresas encontradas');
  assert.equal(grade.filhos.find((cartao) => cartao.dataset.nome === 'Ação').classes.has('empresa-cartao--oculta'), true);

  setor.value = '';
  ordenacao.value = 'za';
  eventos.change();
  assert.deepEqual(grade.filhos.map((cartao) => cartao.dataset.nome), ['Beta', 'Alpha', 'Ação']);

  busca.value = 'inexistente';
  eventos.input();
  assert.equal(resultado.textContent, '0 empresas encontradas');
  assert.equal(semResultados.hidden, false);
});

test('destaques colocam Klinker primeiro e priorizam logos sem alterar a lista original', () => {
  const empresas = [
    { nomeFantasia: 'Alpha sem logo', logoUrl: null },
    { nomeFantasia: 'Zeta com logo', logoUrl: '/zeta.png' },
    { nomeFantasia: 'Cerâmica Klinker', logoUrl: null },
    { nomeFantasia: 'Beta com logo', logoUrl: '/beta.png' },
  ];
  assert.deepEqual(
    selecionarEmpresasDestaque(empresas).map((empresa) => empresa.nomeFantasia),
    ['Cerâmica Klinker', 'Beta com logo'],
  );
  assert.equal(empresas[0].nomeFantasia, 'Alpha sem logo');
  assert.deepEqual(
    selecionarEmpresasDestaque(empresas.filter((empresa) => empresa.nomeFantasia !== 'Cerâmica Klinker'))
      .map((empresa) => empresa.nomeFantasia),
    ['Beta com logo', 'Zeta com logo'],
  );
  assert.deepEqual(selecionarEmpresasDestaque([]), []);
  assert.equal(selecionarEmpresasDestaque(empresas.slice(0, 1)).length, 0);
  const duplicadas = [
    { nomeFantasia: 'Klinker', logoUrl: null },
    { nomeFantasia: 'Klinker', logoUrl: '/klinker.png' },
    { nomeFantasia: 'Outra sem logo', logoUrl: null },
  ];
  assert.deepEqual(selecionarEmpresasDestaque(duplicadas), [duplicadas[1]]);
  assert.deepEqual(
    selecionarEmpresasDestaque([...duplicadas, empresas[1]]),
    [duplicadas[1], empresas[1]],
  );
});

test('início mostra empresas reais, logos e selo de cadastrada sem os cards demonstrativos', async () => {
  const arquivo = fileURLToPath(new URL('../src/views/paginas/inicio.ejs', import.meta.url));
  const empresasDestaque = [
    { nomeFantasia: 'Klinker', logoUrl: '/logo-real.png', categoriaEmpresa: 'Mobilidade' },
    { nomeFantasia: 'Empresa & inclusão', logoUrl: null, categoriaEmpresa: 'Digital' },
  ];
  const html = await ejs.renderFile(arquivo, { empresasDestaque });
  const secao = html.split('<section id="empresas"')[1].split('</section>')[0];
  assert.match(secao, /src="\/logo-real.png"/);
  assert.match(secao, /Empresa &amp; inclusão/);
  assert.match(secao, /empresa-cartao__inicial/);
  assert.match(secao, /Cadastrada/);
  assert.doesNotMatch(secao, /Demonstração|Acessify|acessify-logo/);
  assert.match(secao, /\/catalogo\?empresa=Empresa%20%26%20inclus/);
  assert.match(secao, /href="\/empresas"/);
  const vazio = await ejs.renderFile(arquivo, { empresasDestaque: [] });
  assert.match(vazio, /Sua empresa aqui/);
});
