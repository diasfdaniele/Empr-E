import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../public/assets/js/catalogo.js', import.meta.url), 'utf8');

function iniciar() {
  const campos = [
    { name: 'busca', value: '', type: 'search' },
    { name: 'categoria', value: '', type: 'select-one' },
    { name: 'preco', value: '', type: 'select-one' },
    { name: 'empresa', value: '', type: 'search' },
    { name: 'empresaId', value: '18', type: 'hidden' },
  ];
  for (const campo of campos) {
    campo.remove = () => campos.splice(campos.indexOf(campo), 1);
    campo.matches = (seletor) => seletor === 'select'
      ? campo.type === 'select-one'
      : campo.type === 'search';
  }
  const eventos = {};
  const formulario = {
    action: 'http://localhost:3000/catalogo',
    addEventListener(tipo, callback) { eventos[tipo] = callback; },
    querySelectorAll() { return [...campos]; },
  };
  const resultados = {
    conteudo: 'anterior',
    atributos: {},
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
    replaceChildren(...nos) { this.conteudo = nos.join(''); },
  };
  const estado = {};
  const erro = { hidden: true };
  let limpar;
  let temporizador;
  let endereco;
  const requisicoes = [];
  const elementos = {
    'filtros-catalogo': formulario,
    'catalogo-resultados': resultados,
    'catalogo-filtro-estado': estado,
    'catalogo-filtro-erro': erro,
    'catalogo-limpar': { addEventListener(tipo, callback) { limpar = callback; } },
  };
  runInNewContext(script, {
    document: {
      getElementById(id) { return elementos[id]; },
      addEventListener(tipo, callback) { callback(); },
    },
    URL,
    AbortController,
    FormData: class {
      *[Symbol.iterator]() { for (const campo of campos) yield [campo.name, campo.value]; }
    },
    DOMParser: class {
      parseFromString(texto) {
        return { getElementById() {
          if (texto === 'invalido') return null;
          return {
            childNodes: [texto],
            querySelector() { return { textContent: `${texto} resultado(s)` }; },
          };
        } };
      }
    },
    history: { replaceState(estado, titulo, url) { endereco = url; } },
    console: { error() {} },
    setTimeout(callback, atraso) { temporizador = { callback, atraso }; return 1; },
    clearTimeout() { temporizador = null; },
    fetch(url, opcoes) {
      return new Promise(resolve => requisicoes.push({ url, opcoes, resolve }));
    },
  });
  return {
    campos, resultados, estado, erro, requisicoes,
    get endereco() { return endereco; },
    get atraso() { return temporizador?.atraso; },
    disparar(tipo, nome) {
      eventos[tipo]({ target: campos.find(campo => campo.name === nome), preventDefault() {} });
    },
    limpar() { limpar({ button: 0, preventDefault() {} }); },
    executar() { const callback = temporizador.callback; temporizador = null; return callback(); },
    responder(indice, texto = '2', status = 200) {
      requisicoes[indice].resolve({ ok: status === 200, status, async text() { return texto; } });
    },
  };
}

test('digitação agrupa requisições e seletores atualizam imediatamente preservando filtros', async () => {
  const pagina = iniciar();
  pagina.campos[0].value = 'pi';
  pagina.disparar('input', 'busca');
  pagina.campos[0].value = 'piso';
  pagina.disparar('input', 'busca');
  assert.equal(pagina.atraso, 350);
  assert.equal(pagina.requisicoes.length, 0);
  const primeira = pagina.executar();
  assert.equal(pagina.requisicoes.length, 1);
  assert.equal(pagina.requisicoes[0].url.searchParams.get('busca'), 'piso');
  assert.equal(pagina.requisicoes[0].url.searchParams.get('empresaId'), '18');
  pagina.responder(0);
  await primeira;
  assert.equal(pagina.resultados.conteudo, '2');
  assert.match(pagina.estado.textContent, /2 resultado/);

  pagina.campos[1].value = '6';
  pagina.disparar('change', 'categoria');
  assert.equal(pagina.atraso, 0);
  const segunda = pagina.executar();
  assert.equal(pagina.requisicoes[1].url.searchParams.get('categoria'), '6');
  pagina.responder(1, '1');
  await segunda;
  assert.match(pagina.endereco, /categoria=6/);
});

test('resposta antiga não substitui os resultados do filtro mais recente', async () => {
  const pagina = iniciar();
  pagina.disparar('submit');
  const primeira = pagina.executar();
  pagina.campos[0].value = 'alerta';
  pagina.disparar('input', 'busca');
  assert.equal(pagina.requisicoes[0].opcoes.signal.aborted, true);
  const segunda = pagina.executar();
  pagina.responder(1, 'novo');
  await segunda;
  pagina.responder(0, 'antigo');
  await primeira;
  assert.equal(pagina.resultados.conteudo, 'novo');
  assert.equal(pagina.erro.hidden, true);
  assert.equal(pagina.resultados.atributos['aria-busy'], 'false');
});

test('falhas HTTP e respostas inválidas mostram erro sem apagar resultados, permitindo tentar novamente', async () => {
  for (const [texto, status] of [['erro', 500], ['invalido', 200]]) {
    const pagina = iniciar();
    pagina.disparar('submit');
    const falha = pagina.executar();
    pagina.responder(0, texto, status);
    await falha;
    assert.equal(pagina.erro.hidden, false);
    assert.match(pagina.erro.textContent, /Não foi possível atualizar/);
    assert.equal(pagina.resultados.conteudo, 'anterior');
    assert.equal(pagina.endereco, undefined);
    pagina.disparar('submit');
    const tentativa = pagina.executar();
    pagina.responder(1);
    await tentativa;
    assert.equal(pagina.erro.hidden, true);
    assert.equal(pagina.resultados.conteudo, '2');
  }
});

test('limpar remove todos os filtros, inclusive o vínculo de empresa recebido na URL', async () => {
  const pagina = iniciar();
  pagina.campos[0].value = 'piso';
  pagina.campos[1].value = '6';
  pagina.limpar();
  const atualizacao = pagina.executar();
  assert.equal(pagina.requisicoes[0].url.search, '');
  assert.equal(pagina.campos.some(campo => campo.type === 'hidden'), false);
  pagina.responder(0);
  await atualizacao;
  assert.equal(pagina.endereco, '/catalogo');
});
