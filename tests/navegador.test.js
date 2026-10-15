import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import aplicacao from '../src/aplicacao.js';

const resultsDir = fileURLToPath(new URL('../test-results/', import.meta.url));
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

async function carregarImagens(page) {
  await page.locator('img').evaluateAll(async (imagens) => {
    await Promise.all(
      imagens.map(async (imagem) => {
        imagem.loading = 'eager';
        try {
          await imagem.decode();
        } catch {
          return;
        }
      }),
    );
  });
}

async function comServidor(aplicacao, acao) {
  const server = aplicacao.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await acao(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('interface MVC desktop/mobile e simulacoes sem persistencia', async () => {
  await mkdir(resultsDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    await comServidor(aplicacao, async (url) => {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('https://vlibras.gov.br/**', (route) => route.abort());
        for (const [nome, caminho] of [
          ['inicio', '/'],
          ['catalogo', '/catalogo'],
          ['produto', '/produto/piso-tatil-alerta'],
          ['carrinho', '/carrinho'],
          ['pagamento', '/pagamento'],
          ['cadastro', '/cadastro'],
          ['login', '/login'],
          ['institucional', '/institucional'],
          ['conta', '/conta'],
          ['vendedor', '/conta/vendedor'],
          ['admin', '/conta/admin'],
          ['404', '/inexistente'],
        ]) {
          await page.goto(`${url}${caminho}`, { waitUntil: 'networkidle' });
          await carregarImagens(page);
          await page.screenshot({
            path: `${resultsDir}/mvc-${nome}-${viewport.name}.png`,
            fullPage: true,
          });
          assert.equal(await page.locator('header#cabecalho').count(), 1, caminho);
          assert.equal(await page.locator('footer#rodape').count(), 1, caminho);
          assert.equal(await page.locator('h1').count(), 1, caminho);
          const transbordamento = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          );
          assert.equal(
            transbordamento,
            false,
            `${caminho}: overflow horizontal em ${viewport.name}`,
          );
          const imagensAusentes = await page
            .locator('img')
            .evaluateAll((imagens) =>
              imagens
                .filter((imagem) => !imagem.complete || imagem.naturalWidth === 0)
                .map((imagem) => imagem.src),
            );
          assert.deepEqual(imagensAusentes, [], `${caminho}: imagens ausentes`);
          if (nome === 'catalogo') {
            const recortado = await page.locator('.produto-cartao').evaluateAll((cartoes) =>
              cartoes.some((cartao) => {
                const limites = cartao.getBoundingClientRect();
                return ['.produto-cartao__titulo', '.produto-cartao__preco'].some((seletor) => {
                  const retangulo = cartao.querySelector(seletor).getBoundingClientRect();
                  return retangulo.top < limites.top || retangulo.bottom > limites.bottom;
                });
              }),
            );
            assert.equal(recortado, false, 'Conteudo recortado nos cards');
          }
          if (nome === 'inicio') {
            const atual = await page.locator('.destaque').evaluate((elemento) => {
              const retangulo = elemento.getBoundingClientRect();
              return {
                top: retangulo.top,
                height: retangulo.height,
                background: getComputedStyle(elemento).backgroundColor,
              };
            });
            assert.ok(atual.height > 0, 'O destaque inicial deve estar visível');
            assert.ok(await page.locator('#destaque-titulo').isVisible());
          }
        }
        await page.goto(`${url}/catalogo`);
        await page.locator('[data-favorito]').first().click();
        assert.equal(
          await page.locator('[data-favorito]').first().getAttribute('aria-pressed'),
          'true',
        );
        await page.locator('[data-adicionar-carrinho]').first().click();
        assert.match(await page.locator('#demo-estado').innerText(), /simula/i);
        await page.locator('#campo-busca').fill('software');
        await page.locator('#filtros-catalogo button[type=submit]').click();
        await page.waitForURL('**/catalogo?**');
        assert.equal(await page.locator('.produto-cartao').count(), 1);
        await page.goto(`${url}/produto/piso-tatil-alerta`);
        await page.locator('[data-imagem-miniatura]').nth(1).click();
        assert.match(
          await page.locator('#produto-detalhe-imagem-principal').getAttribute('src'),
          /alerta-2/,
        );
        await page.goto(`${url}/carrinho`);
        await page.locator('[data-quantidade="aumentar"]').first().click();
        assert.equal(await page.locator('[data-quantidade-item]').first().innerText(), '3');
        await page.reload();
        assert.equal(await page.locator('[data-quantidade-item]').first().innerText(), '2');
        await page.locator('#botao-limpar-carrinho').click();
        assert.equal(await page.locator('[data-linha-carrinho]').count(), 0);
        assert.match(await page.locator('#resumo-valor').innerText(), /0,00/);
        await page.goto(`${url}/cadastro`);
        assert.equal(await page.locator('[data-campos-pj]').isVisible(), false);
        await page.locator('#pessoa-tipo').selectOption('pj');
        assert.equal(await page.locator('[data-campos-pj]').isVisible(), true);
        await page.locator('#pessoa-tipo').selectOption('pf');
        assert.equal(
          await page.locator('#perfil-comercial option[value=vendedor]').isDisabled(),
          true,
        );
        assert.equal(await page.locator('input[type=email]').isDisabled(), true);
        assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
        await page.goto(`${url}/pagamento`);
        await page.route('https://viacep.com.br/ws/01001000/json/', (route) =>
          route.fulfill({
            json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' },
          }),
        );
        await page.locator('#botao-consultar-cep').click();
        await page.waitForFunction(() =>
          document.querySelector('#cep-estado').textContent.includes('São Paulo'),
        );
        await page.route('https://viacep.com.br/ws/01001000/json/', (route) => route.abort());
        await page.locator('#botao-consultar-cep').click();
        await page.waitForFunction(() =>
          document.querySelector('#cep-estado').textContent.includes('Não foi possível'),
        );
        await page.locator('#botao-contraste').click();
        assert.equal(
          await page
            .locator('body')
            .evaluate((elemento) => elemento.classList.contains('modo-alto-contraste')),
          true,
        );
        await page.locator('#botao-aumentar-fonte').click();
        await page.locator('#botao-simplificado').click();
        await page.locator('#botao-leitura').click();
        await page.screenshot({
          path: `${resultsDir}/mvc-acessibilidade-${viewport.name}.png`,
          fullPage: true,
        });
        if (viewport.name === 'mobile') {
          await page.locator('#botao-menu-movel').click();
          assert.equal(await page.locator('#menu-movel').isVisible(), true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#menu-movel').isVisible(), false);
          await page.locator('.atalho-navegacao[href="#navegacao-principal"]').focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#menu-movel').isVisible(), true);
          assert.equal(
            await page
              .locator('#menu-movel a')
              .first()
              .evaluate((elemento) => elemento === document.activeElement),
            true,
          );
        }
        await page.goto(url);
        await page.keyboard.press('Tab');
        assert.equal(
          await page
            .locator('.atalho-navegacao')
            .first()
            .evaluate((elemento) => elemento === document.activeElement),
          true,
        );
        assert.deepEqual(
          await page.evaluate(() => ({
            local: localStorage.length,
            session: sessionStorage.length,
            cookies: document.cookie,
          })),
          { local: 0, session: 0, cookies: '' },
        );
        assert.deepEqual(errors, []);
        await page.close();
      }
    });
  } finally {
    await browser.close();
  }
});
