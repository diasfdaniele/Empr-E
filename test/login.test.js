import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const script = await readFile(new URL('../public/assets/js/recuperar-senha.js', import.meta.url), 'utf8');
const recuperacaoHtml = await ejs.renderFile(fileURLToPath(new URL('../src/views/paginas/recuperar-senha.ejs', import.meta.url)), {});
const idsRecuperacao = new Set([...recuperacaoHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

function iniciarSimulacao() {
  const elementos = new Map();
  let agora = 0;
  const document = {
    getElementById(id) {
      if (!idsRecuperacao.has(id)) return null;
      if (!elementos.has(id)) {
        elementos.set(id, {
          hidden: true,
          value: '',
          textContent: '',
          atributos: {},
          eventos: {},
          addEventListener(tipo, callback) { this.eventos[tipo] = callback; },
          setAttribute(nome, valor) { this.atributos[nome] = valor; },
          removeAttribute(nome) { delete this.atributos[nome]; },
          focus() { document.ativo = id; },
          reportValidity() { return true; },
          reset() {
            const ids = id === 'recuperacao-email-form'
              ? ['recuperacao-email']
              : ['recuperacao-codigo', 'recuperacao-senha', 'recuperacao-confirmacao'];
            for (const campo of ids) document.getElementById(campo).value = '';
          },
        });
      }
      return elementos.get(id);
    },
    addEventListener(tipo, callback) { callback(); },
  };
  runInNewContext(script, {
    document,
    crypto: { getRandomValues(valores) { valores[0] = 123456; return valores; } },
    Date: { now: () => agora },
  });
  const obter = (id) => document.getElementById(`recuperacao-${id}`);
  const disparar = (id, evento = 'submit') => obter(id).eventos[evento]({ preventDefault() {} });
  const gerar = () => {
    obter('email').value = 'teste@example.com';
    disparar('email-form');
  };
  return { obter, disparar, gerar, document, expirar: () => { agora = 600000; } };
}

test('login apresenta contexto real e links para cadastro e recuperação', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../src/views/paginas/login.ejs', import.meta.url)), { erro: null });
  assert.doesNotMatch(html, /demonstrativ|recuperação de senha indisponível/i);
  assert.match(html, /href="\/cadastro"[^>]*>Crie sua conta gratuitamente/);
  assert.match(html, /href="\/recuperar-senha"/);
});

test('recuperação impede envio de campos sem JavaScript', () => {
  assert.match(recuperacaoHtml, /id="recuperacao-email-form"[^>]*hidden/);
  assert.doesNotMatch(recuperacaoHtml, /<input[^>]*\bname=/);
});

test('simulação confere código e confirmação antes de concluir, sem persistir a senha', () => {
  const { obter, disparar, gerar, document } = iniciarSimulacao();
  gerar();
  assert.equal(obter('email-form').hidden, true);
  assert.equal(obter('senha-form').hidden, false);
  assert.match(obter('codigo-exibido').textContent, /^\d{6}$/);
  obter('codigo').value = '000000';
  obter('senha').value = 'senha-teste';
  obter('confirmacao').value = 'diferente';
  disparar('senha-form');
  assert.match(obter('erro').textContent, /Código incorreto/);
  assert.equal(obter('concluida').hidden, true);
  obter('codigo').value = obter('codigo-exibido').textContent;
  disparar('senha-form');
  assert.match(obter('erro').textContent, /precisam ser iguais/);
  obter('confirmacao').value = 'senha-teste';
  disparar('senha-form');
  assert.equal(obter('concluida').hidden, false);
  assert.equal(obter('senha-form').hidden, true);
  assert.equal(obter('senha').value, '');
  assert.equal(obter('email').value, '');
  assert.equal(obter('codigo-exibido').textContent, '');
  assert.equal(document.ativo, 'recuperacao-sucesso-titulo');
});

test('código expira em dez minutos e recarregar permite gerar outro', () => {
  const { obter, disparar, gerar, expirar } = iniciarSimulacao();
  gerar();
  obter('codigo').value = obter('codigo-exibido').textContent;
  expirar();
  disparar('senha-form');
  assert.match(obter('erro').textContent, /expirou/);
  assert.equal(obter('concluida').hidden, true);
  assert.match(obter('erro').textContent, /Recarregue a página/);
  const novaPagina = iniciarSimulacao();
  assert.equal(novaPagina.obter('email-form').hidden, false);
  novaPagina.gerar();
  novaPagina.obter('codigo').value = novaPagina.obter('codigo-exibido').textContent;
  novaPagina.obter('senha').value = 'outra-senha';
  novaPagina.obter('confirmacao').value = 'outra-senha';
  novaPagina.disparar('senha-form');
  assert.equal(novaPagina.obter('concluida').hidden, false);
});
