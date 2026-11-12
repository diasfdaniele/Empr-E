import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  verificarEmpresaVendedora, validarDadosProduto, validarFotos,
  buscarProdutoVendedor, salvarProdutoVendedor, LIMITE_IMAGEM,
  excluirProdutoVendedor,
} from '../src/services/produtos-vendedor.js';
import { autorizarVendedor, validarTokenProduto, salvarProduto, excluirProduto } from '../src/controllers/vendas.js';
import { uploadProduto } from '../src/middlewares/upload-produto.js';
import express from 'express';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { cadastrarUsuario } from '../src/services/autenticacao.js';

const dados = {
  nome: 'Piso tátil', descricao: 'Piso para orientação.', categoria: '1',
  preco: '20.50', estoque: '10', estoqueMinimo: '1', modalidade: 'Compra', ativo: 'on',
};

test('cadastro PJ vendedor cria empresa ativa sem aceitar status informado pelo cliente', async (t) => {
  const anteriores = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://cadastro-teste.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'chave-publicavel-de-teste';
  t.after(() => {
    for (const [nome, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });
  let empresaRecebida;
  const idAuth = '00000000-0000-0000-0000-000000000001';
  const usuario = { id_usuario: 1, id_auth: idAuth, tipo_pessoa: 'pj', nome_completo: 'Pessoa teste' };
  t.mock.method(globalThis, 'fetch', async (entrada, opcoes) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url ?? entrada.toString());
    const body = JSON.parse(opcoes?.body ?? '{}');
    let resposta;
    if (url.pathname === '/auth/v1/signup') {
      const payload = Buffer.from(JSON.stringify({ sub: idAuth, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      resposta = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.assinatura-teste`,
        refresh_token: 'refresh-teste', expires_in: 3600, token_type: 'bearer', user: { id: idAuth } };
    } else if (url.pathname === '/rest/v1/usuarios') {
      resposta = usuario;
    } else if (url.pathname === '/rest/v1/empresas') {
      empresaRecebida = body;
      resposta = { ...body, id_empresa: 1 };
    } else {
      assert.fail('Requisição inesperada no cadastro simulado');
    }
    return new Response(JSON.stringify(resposta), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const resultado = await cadastrarUsuario({
    email: 'vendedor@example.com', senha: 'senha-de-teste', confirmarSenha: 'senha-de-teste',
    tipoPessoa: 'pj', perfilComercial: 'vendedor', nomeCompleto: 'Pessoa teste',
    cpfPessoa: '12345678901', cnpj: '12345678000199', razaoSocial: 'Empresa teste',
    nomeFantasia: 'Empresa teste', status_conta: 'Aguardando Aprovação',
  });
  assert.equal(empresaRecebida.status_conta, 'Ativo');
  assert.equal(resultado.empresa.status_conta, 'Ativo');
});

test('pessoa física não pode se cadastrar como vendedora', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('PF não deve iniciar cadastro de vendedor'));
  await assert.rejects(cadastrarUsuario({ tipoPessoa: 'pf', perfilComercial: 'vendedor' }), /Somente pessoas jurídicas/);
});

function consulta(resultado, filtros = []) {
  const builder = {
    select() { return this; },
    eq(campo, valor) { filtros.push([campo, valor]); return this; },
    order() { return this; },
    single: async () => resultado,
    maybeSingle: async () => resultado,
    then(resolve, reject) { return Promise.resolve(resultado).then(resolve, reject); },
  };
  return builder;
}

test('perfil PF e empresa não ativa não podem gerenciar produtos', async () => {
  for (const [tipo, status] of [['pf', 'Ativo'], ['pj', 'Aguardando Aprovação']]) {
    const cliente = { from(tabela) {
      return consulta({ data: tabela === 'usuarios'
        ? { id_usuario: 1, tipo_pessoa: tipo }
        : { id_empresa: 2, status_conta: status }, error: null });
    } };
    await assert.rejects(verificarEmpresaVendedora(cliente, 'auth'), { status: 403 });
  }
});

test('empresa é verificada pelo usuário autenticado, não por ID recebido no formulário', async () => {
  const filtros = [];
  const empresa = { id_empresa: 2, status_conta: 'Ativo' };
  const cliente = { from(tabela) {
    return consulta({ data: tabela === 'usuarios'
      ? { id_usuario: 7, tipo_pessoa: 'pj' } : empresa, error: null }, filtros);
  } };
  assert.equal(await verificarEmpresaVendedora(cliente, 'auth-verificado'), empresa);
  assert.deepEqual(filtros, [['id_auth', 'auth-verificado'], ['id_usuario', 7]]);
});

test('preço, estoque, categoria e campos obrigatórios são validados', () => {
  assert.equal(validarDadosProduto(dados).preco_unitario, 20.5);
  for (const alteracao of [{ preco: '-1' }, { preco: '1.001' }, { preco: '' }, { estoque: '1.5' },
    { categoria: '0' }, { nome: '' }, { modalidade: 'invalida' }]) {
    assert.throws(() => validarDadosProduto({ ...dados, ...alteracao }));
  }
});

test('arquivo falso, SVG e arquivo grande são recusados antes do upload', async () => {
  const arquivo = { buffer: Buffer.from('<svg></svg>'), size: 11, mimetype: 'image/png' };
  await assert.rejects(validarFotos([arquivo], ['Padrão']));
  await assert.rejects(validarFotos([{ ...arquivo, size: LIMITE_IMAGEM + 1 }], ['Padrão']));
});

test('JPEG real é reconhecido pelo conteúdo, não pelo nome', async () => {
  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  const fotos = await validarFotos([{ buffer, size: buffer.length, originalname: 'foto.exe' }], ['Amarelo']);
  assert.equal(fotos[0].mime, 'image/jpeg');
  assert.equal(fotos[0].variacao, 'Amarelo');
});

test('produto de outra empresa não pode ser consultado para edição', async () => {
  const filtros = [];
  const contexto = { empresa: { id_empresa: 5 }, cliente: { from() {
    return consulta({ data: null, error: null }, filtros);
  } } };
  await assert.rejects(buscarProdutoVendedor(contexto, '9'), { status: 404 });
  assert.deepEqual(filtros, [['id_produto', 9], ['fk_vendedor', 5]]);
});

test('falha na gravação remove as fotos enviadas e não simula sucesso', async () => {
  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  const removidas = [];
  const base = 'https://teste.supabase.co/storage/v1/object/public/ImagensProdutos/';
  const storage = {
    upload: async () => ({ error: null }),
    getPublicUrl: caminho => ({ data: { publicUrl: base + caminho } }),
    remove: async caminhos => { removidas.push(...caminhos); return { error: null }; },
  };
  const contexto = { idAuth: 'auth-id', empresa: { id_empresa: 1 }, cliente: {
    from: () => consulta({ data: [{ id_categoria: 1 }], error: null }),
    storage: { from: () => storage },
    rpc: async () => ({ error: { code: '42501' } }),
  } };
  await assert.rejects(salvarProdutoVendedor(contexto, null, dados,
    [{ buffer, size: buffer.length }], ['Padrão']));
  assert.equal(removidas.length, 1);
  assert.match(removidas[0], /^auth-id\/.+\.jpg$/);
});

test('salvamento associa URLs públicas e empresa sem aceitar fk_vendedor do formulário', async () => {
  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  let chamada;
  const storage = {
    upload: async () => ({ error: null }),
    getPublicUrl: caminho => ({ data: { publicUrl: 'https://teste/storage/v1/object/public/ImagensProdutos/' + caminho } }),
  };
  const contexto = { idAuth: 'auth-id', empresa: { id_empresa: 1 }, cliente: {
    from: () => consulta({ data: [{ id_categoria: 1 }], error: null }),
    storage: { from: () => storage },
    rpc: async (nome, parametros) => { chamada = { nome, parametros }; return { data: 15, error: null }; },
  } };
  const resultado = await salvarProdutoVendedor(contexto, null, { ...dados, fk_vendedor: 999 },
    [{ buffer, size: buffer.length }], ['Amarelo']);
  assert.equal(resultado.id, 15);
  assert.equal(chamada.nome, 'salvar_produto_vendedor');
  assert.equal(chamada.parametros.p_dados.fk_vendedor, undefined);
  assert.equal(chamada.parametros.p_imagens[0].nome_variacao, 'Amarelo');
  assert.match(chamada.parametros.p_imagens[0].caminho_arquivo, /ImagensProdutos\/auth-id\//);
});

test('falhas do Supabase identificam etapa e código sem expor dados privados', async (t) => {
  const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
  const logs = [];
  t.mock.method(console, 'error', (...argumentos) => logs.push(argumentos));
  const casos = [
    { etapa: 'storage', erro: { statusCode: '403', message: 'new row violates row-level security policy' }, referencia: /storage\/permissao/ },
    { etapa: 'storage', erro: { statusCode: '413', message: 'too large' }, referencia: /storage\/arquivo/ },
    { etapa: 'banco', erro: { code: '42501', message: 'permission denied' }, referencia: /banco\/42501/ },
    { etapa: 'banco', erro: { code: '23502', message: 'null value in column "unidade"; dados privados de teste' }, referencia: /unidade.*banco\/23502/ },
    { etapa: 'banco', erro: { code: '42804', message: 'tipo incompatível' }, referencia: /banco\/42804/ },
    { etapa: 'banco', erro: { code: '22023', message: 'Invalid image or storage ownership' }, referencia: /banco\/imagem/ },
  ];
  for (const caso of casos) {
    const storage = {
      upload: async () => ({ error: caso.etapa === 'storage' ? caso.erro : null }),
      getPublicUrl: caminho => ({ data: { publicUrl: 'https://teste/ImagensProdutos/' + caminho } }),
      remove: async () => ({ error: null }),
    };
    const contexto = { idAuth: 'auth-id', empresa: { id_empresa: 1 }, cliente: {
      from: () => consulta({ data: [{ id_categoria: 1 }], error: null }),
      storage: { from: () => storage },
      rpc: async () => ({ error: caso.erro }),
    } };
    await assert.rejects(salvarProdutoVendedor(contexto, null, dados,
      [{ buffer, size: buffer.length }], ['Padrão']), erro => {
      assert.match(erro.message, caso.referencia);
      assert.doesNotMatch(erro.message, /dados privados/);
      return true;
    });
  }
  assert.doesNotMatch(JSON.stringify(logs), /dados privados/);
});

test('exclusão de produto alheio não chama a função SQL nem o Storage', async () => {
  const contexto = { empresa: { id_empresa: 5 }, cliente: {
    from: () => consulta({ data: null, error: null }),
    rpc: () => assert.fail('Não deve excluir produto alheio'),
  } };
  await assert.rejects(excluirProdutoVendedor(contexto, 9), { status: 404 });
});

test('CSRF ausente, inválido e multibyte são recusados', () => {
  const session = { csrfProdutos: 'a'.repeat(64) };
  for (const token of [undefined, '', 'b'.repeat(64), 'é'.repeat(64), ['a'.repeat(64)]]) {
    assert.equal(validarTokenProduto({ session, body: { _csrf: token } }), false);
  }
  assert.equal(validarTokenProduto({ session, body: { _csrf: 'a'.repeat(64) } }), true);
});

test('formulário renderiza cadastro e edição com multipart e fotos atuais', async () => {
  const fixture = {
    empresa: { nome_fantasia: 'Empresa teste' }, produtos: [], categorias: [{ id_categoria: 1, nome_categoria: 'Visual' }],
    modalidades: ['Compra', 'Sob Consulta'], csrf: 'teste', erroFormulario: null, aviso: null,
    formulario: { ...dados }, formatarMoeda: String,
  };
  for (const produto of [null, { id_produto: 1, imagens: [{ idImagem: 2, caminho_arquivo: '/assets/img/direcional-1.jpg', nome_variacao: 'Amarelo' }] }]) {
    const html = await ejs.renderFile(fileURLToPath(new URL('../src/views/restritas/vendedor.ejs', import.meta.url)), { ...fixture, produto });
    assert.match(html, /enctype="multipart\/form-data"/);
    assert.match(html, /name="imagens"/);
    assert.match(html, /name="_csrf"/);
    assert.equal((html.match(/<fieldset/g) ?? []).length, 3);
    assert.match(html, /aria-describedby="fotos-formatos fotos-erro"/);
    assert.match(html, /id="fotos-estado"[^>]*role="status"/);
    assert.match(html, /id="produto-envio-estado"[^>]*role="status"/);
    if (produto) {
      assert.match(html, /name="removerImagens"/);
      assert.match(html, /aria-label="Remover foto da variação Amarelo"/);
    }
  }
});

test('HTTP: visitante e PF não acessam cadastro, edição ou exclusão', async () => {
  const app = express();
  app.use((req, res, next) => {
    req.session = req.get('x-perfil') === 'pf'
      ? { usuario: { tipoPessoa: 'pf' }, tokens: { accessToken: 'teste' } } : {};
    res.render = () => res.send('Acesso restrito');
    next();
  });
  app.use(autorizarVendedor);
  app.use((_req, res) => res.sendStatus(200));
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.once('listening', resolve));
  try {
    const base = 'http://127.0.0.1:' + servidor.address().port;
    for (const [method, path] of [['GET', '/conta/vendedor'], ['POST', '/conta/vendedor/produtos'],
      ['GET', '/conta/vendedor/produtos/1/editar'], ['POST', '/conta/vendedor/produtos/1'],
      ['POST', '/conta/vendedor/produtos/1/excluir']]) {
      const visitante = await fetch(base + path, { method, redirect: 'manual' });
      assert.equal(visitante.status, 302);
      assert.equal(visitante.headers.get('location'), '/login');
      const pf = await fetch(base + path, { method, headers: { 'x-perfil': 'pf' }, redirect: 'manual' });
      assert.equal(pf.status, 403);
    }
  } finally {
    servidor.closeAllConnections();
    await new Promise(resolve => servidor.close(resolve));
  }
});

test('HTTP: parser recebe JPEG multipart e CSRF antes de salvar', async () => {
  const app = express();
  app.post('/upload', uploadProduto, (req, res) => {
    assert.equal(req.body._csrf, 'teste');
    assert.equal(req.files.length, 1);
    assert.equal(req.files[0].fieldname, 'imagens');
    res.sendStatus(200);
  });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.once('listening', resolve));
  try {
    const buffer = await readFile(new URL('../public/assets/img/direcional-1.jpg', import.meta.url));
    const form = new FormData();
    form.append('_csrf', 'teste');
    form.append('imagens', new Blob([buffer], { type: 'image/jpeg' }), 'foto.jpg');
    const resposta = await fetch('http://127.0.0.1:' + servidor.address().port + '/upload', { method: 'POST', body: form });
    assert.equal(resposta.status, 200);
  } finally {
    servidor.closeAllConnections();
    await new Promise(resolve => servidor.close(resolve));
  }
});

test('ações recusam CSRF antes de chamar o serviço', async () => {
  for (const acao of [salvarProduto, excluirProduto]) {
    const res = { status(codigo) { this.codigo = codigo; return this; }, render() {} };
    await acao({ session: { csrfProdutos: 'teste' }, body: {} }, res);
    assert.equal(res.codigo, 403);
  }
});

test('PostgreSQL isolado: funções respeitam RLS e preservam dados em falhas', async (t) => {
  const db = new PGlite();
  const vendedor = '00000000-0000-0000-0000-000000000001';
  const outro = '00000000-0000-0000-0000-000000000002';
  const comprador = '00000000-0000-0000-0000-000000000003';
  const foto = '10000000-0000-0000-0000-000000000001.jpg';
  const url = `https://teste.supabase.co/storage/v1/object/public/ImagensProdutos/${vendedor}/${foto}`;
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create schema storage;
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create function storage.foldername(text) returns text[] language sql immutable as
        'select string_to_array($1, ''/'')';
      grant usage on schema auth, storage to authenticated, anon;
      create table public.usuarios (id_usuario serial primary key, id_auth uuid unique, tipo_pessoa text);
      create table public.empresas (id_empresa serial primary key, id_usuario integer references public.usuarios, nome_fantasia text, status_conta text);
      create table public.categorias (id_categoria serial primary key, nome_categoria text);
      create table public.produtos (
        id_produto serial primary key, fk_vendedor integer references public.empresas,
        fk_categoria integer references public.categorias, nome_produto text, descricao text,
        preco_unitario numeric(10,2), estoque_atual integer, estoque_minimo integer,
        tipo_compra text check (tipo_compra in ('Compra', 'Sob Consulta')), ativo boolean
      );
      create table public."produtosImagens" (
        "idImagem" serial primary key, "idProduto" integer references public.produtos,
        nome_arquivo text not null, caminho_arquivo text, nome_variacao text
      );
      create table public.pedidos_teste (produto integer references public.produtos);
      create table storage.objects (bucket_id text, name text, primary key(bucket_id, name));
      alter table storage.objects enable row level security;
      grant select, insert, delete on storage.objects to authenticated;
      insert into public.usuarios(id_auth, tipo_pessoa) values
        ('${vendedor}', 'pj'), ('${outro}', 'pj'), ('${comprador}', 'pf');
      insert into public.empresas(id_usuario, nome_fantasia, status_conta) values
        (1, 'Empresa A', 'Ativo'), (2, 'Empresa B', 'Ativo');
      insert into public.categorias(nome_categoria) values ('Visual');
      create function public.usuario_id_atual() returns integer language sql stable as
        'select id_usuario from public.usuarios where id_auth = auth.uid()';
      create policy seller_product_writes on public.produtos for all to authenticated
        using (exists(select 1 from public.empresas e where e.id_empresa = produtos.fk_vendedor
          and e.id_usuario = public.usuario_id_atual() and e.status_conta = 'Ativo'))
        with check (exists(select 1 from public.empresas e where e.id_empresa = produtos.fk_vendedor
          and e.id_usuario = public.usuario_id_atual() and e.status_conta = 'Ativo'));
      create policy seller_image_writes on public."produtosImagens" for all to authenticated
        using (exists(select 1 from public.produtos p join public.empresas e on e.id_empresa = p.fk_vendedor
          where p.id_produto = "produtosImagens"."idProduto" and e.id_usuario = public.usuario_id_atual() and e.status_conta = 'Ativo'))
        with check (exists(select 1 from public.produtos p join public.empresas e on e.id_empresa = p.fk_vendedor
          where p.id_produto = "produtosImagens"."idProduto" and e.id_usuario = public.usuario_id_atual() and e.status_conta = 'Ativo'));
    `);
    const script = await readFile(new URL('../database/produtos-vendedor.sql', import.meta.url), 'utf8');
    await db.exec(script);
    await db.exec(script);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${vendedor}', false);`);
    const campos = validarDadosProduto(dados);
    const imagens = [{ caminho_arquivo: url, nome_variacao: 'Amarelo' }];
    const salvar = (id, valores = campos, fotos = imagens) => db.query(
      'select public.salvar_produto_vendedor($1, $2::jsonb, $3::jsonb, $4::bigint[]) as id',
      [id, JSON.stringify(valores), JSON.stringify(fotos), []]
    );
    let id;
    await t.test('upload restrito à pasta do vendedor', async () => {
      await db.query('insert into storage.objects(bucket_id, name) values ($1, $2)', ['ImagensProdutos', `${vendedor}/${foto}`]);
      await assert.rejects(db.query('insert into storage.objects(bucket_id, name) values ($1, $2)', ['ImagensProdutos', `${outro}/${foto}`]));
    });
    await t.test('cadastro grava produto e foto juntos', async () => {
      id = (await salvar(null)).rows[0].id;
      assert.equal((await db.query('select count(*)::integer as total from public."produtosImagens"')).rows[0].total, 1);
      const imagem = (await db.query('select nome_arquivo, caminho_arquivo from public."produtosImagens" where "idProduto" = $1', [id])).rows[0];
      assert.equal(imagem.nome_arquivo, foto);
      assert.equal(imagem.caminho_arquivo, url);
    });
    await t.test('erro em imagem reverte edição e mantém foto existente', async () => {
      await assert.rejects(salvar(id, { ...campos, nome_produto: 'Não deve salvar' }, [
        { caminho_arquivo: url.replace(foto, '20000000-0000-0000-0000-000000000002.jpg'), nome_variacao: 'Azul' },
      ]));
      const produto = (await db.query('select nome_produto from public.produtos where id_produto = $1', [id])).rows[0];
      assert.equal(produto.nome_produto, campos.nome_produto);
    });
    await t.test('edição sem novas fotos e inativação funcionam', async () => {
      await salvar(id, { ...campos, ativo: false }, []);
      const produto = (await db.query('select ativo from public.produtos where id_produto = $1', [id])).rows[0];
      assert.equal(produto.ativo, false);
    });
    await t.test('outro vendedor não edita nem exclui o produto', async () => {
      await db.exec(`select set_config('request.jwt.claim.sub', '${outro}', false);`);
      await assert.rejects(salvar(id, campos, []));
      await assert.rejects(db.query('select public.excluir_produto_vendedor($1)', [id]));
    });
    await t.test('PF e anon não podem chamar operações de gerenciamento', async () => {
      await db.exec(`select set_config('request.jwt.claim.sub', '${comprador}', false);`);
      await assert.rejects(salvar(null));
      await db.exec('reset role; set role anon;');
      await assert.rejects(salvar(null));
      await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${vendedor}', false);`);
    });
    await t.test('produto vinculado a pedido não é excluído parcialmente', async () => {
      await db.exec('reset role;');
      await db.query('insert into public.pedidos_teste(produto) values ($1)', [id]);
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${vendedor}', false);`);
      await assert.rejects(db.query('select public.excluir_produto_vendedor($1)', [id]));
      assert.equal((await db.query('select count(*)::integer as total from public."produtosImagens"')).rows[0].total, 1);
      await db.exec('reset role; delete from public.pedidos_teste; set role authenticated;');
    });
    await t.test('exclusão remove produto e vínculos de imagens juntos', async () => {
      await db.query('select public.excluir_produto_vendedor($1)', [id]);
      assert.equal((await db.query('select count(*)::integer as total from public.produtos')).rows[0].total, 0);
      assert.equal((await db.query('select count(*)::integer as total from public."produtosImagens"')).rows[0].total, 0);
    });
  } finally {
    await db.close();
  }
});