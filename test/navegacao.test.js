import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';

const cabecalho = fileURLToPath(new URL('../src/views/partials/cabecalho.ejs', import.meta.url));

test('visitante não recebe links de carrinho ou conta no cabeçalho, incluindo menu móvel', async () => {
  const html = await ejs.renderFile(cabecalho, {
    pagina: 'inicio',
    usuarioLogado: false,
    usuarioSessao: null,
  });

  assert.doesNotMatch(html, /href="\/(?:carrinho|conta)(?:\/[^"]*)?"/);
  assert.doesNotMatch(html, /action="\/logout"/);
  assert.equal((html.match(/href="\/login"/g) || []).length, 2);
  assert.equal((html.match(/href="\/cadastro"/g) || []).length, 2);
});

for (const papel of ['comprador', 'administrador']) {
  test(`usuário ${papel} recebe carrinho acessível e ações autenticadas nos dois menus`, async () => {
    const html = await ejs.renderFile(cabecalho, {
      pagina: 'inicio',
      usuarioLogado: true,
      usuarioSessao: { papel },
    });

    assert.match(html, /href="\/carrinho"[^>]*aria-label="Meu carrinho"[^>]*>\s*<svg/);
    assert.equal((html.match(/href="\/carrinho"/g) || []).length, 2);
    assert.equal((html.match(/href="\/conta"/g) || []).length, 2);
    assert.equal((html.match(/action="\/logout"/g) || []).length, 2);
    assert.doesNotMatch(html, /href="\/(?:login|cadastro)"/);
    assert.equal((html.match(/href="\/conta\/admin"/g) || []).length, papel === 'administrador' ? 2 : 0);
  });
}
