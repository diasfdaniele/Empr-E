import testar from 'node:test';
import verificar from 'node:assert/strict';
import { mkdir as criarPasta } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import aplicacao from '../src/aplicacao.js';

const resultados = fileURLToPath(new URL('../test-results/', import.meta.url));
const tamanhos = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

async function carregarImagens(pagina) {
  await pagina.locator('img').evaluateAll(async (imagens) => {
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
  const servidor = aplicacao.listen(0, '127.0.0.1');
  await new Promise((resolver) => servidor.once('listening', resolver));
  try {
    await acao(`http://127.0.0.1:${servidor.address().port}`);
  } finally {
    await new Promise((resolver, rejeitar) =>
      servidor.close((erro) => (erro ? rejeitar(erro) : resolver())),
    );
  }
}

testar('interface MVC desktop/mobile e simulacoes sem persistencia', async () => {
  await criarPasta(resultados, { recursive: true });
  const navegador = await chromium.launch({ channel: 'chromium' });
  try {
    await comServidor(aplicacao, async (url) => {
      for (const tamanho of tamanhos) {
        const pagina = await navegador.newPage({
          viewport: { width: tamanho.width, height: tamanho.height },
        });
        const erros = [];
        pagina.on('pageerror', (erro) => erros.push(erro.message));
        await pagina.route('https://vlibras.gov.br/**', (route) => route.abort());
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
          await pagina.goto(`${url}${caminho}`, { waitUntil: 'networkidle' });
          await carregarImagens(pagina);
          await pagina.screenshot({
            path: `${resultados}/mvc-${nome}-${tamanho.name}.png`,
            fullPage: true,
          });
          verificar.equal(await pagina.locator('header#cabecalho').count(), 1, caminho);
          verificar.equal(await pagina.locator('footer#rodape').count(), 1, caminho);
          verificar.equal(await pagina.locator('h1').count(), 1, caminho);
          const transbordamento = await pagina.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          );
          verificar.equal(
            transbordamento,
            false,
            `${caminho}: overflow horizontal em ${tamanho.name}`,
          );
          const imagensAusentes = await pagina
            .locator('img')
            .evaluateAll((imagens) =>
              imagens
                .filter((imagem) => !imagem.complete || imagem.naturalWidth === 0)
                .map((imagem) => imagem.src),
            );
          verificar.deepEqual(imagensAusentes, [], `${caminho}: imagens ausentes`);
          if (nome === 'catalogo') {
            const recortado = await pagina.locator('.produto-cartao').evaluateAll((cartoes) =>
              cartoes.some((cartao) => {
                const limites = cartao.getBoundingClientRect();
                return ['.produto-cartao__titulo', '.produto-cartao__preco'].some((seletor) => {
                  const retangulo = cartao.querySelector(seletor).getBoundingClientRect();
                  return retangulo.top < limites.top || retangulo.bottom > limites.bottom;
                });
              }),
            );
            verificar.equal(recortado, false, 'Conteudo recortado nos cards');
          }
          if (nome === 'inicio') {
            const atual = await pagina.locator('.destaque').evaluate((elemento) => {
              const retangulo = elemento.getBoundingClientRect();
              return {
                top: retangulo.top,
                height: retangulo.height,
                background: getComputedStyle(elemento).backgroundColor,
              };
            });
            verificar.ok(atual.height > 0, 'O destaque inicial deve estar visível');
            verificar.ok(await pagina.locator('#destaque-titulo').isVisible());
          }
        }
        await pagina.goto(`${url}/catalogo`);
        await pagina.locator('[data-favorito]').first().click();
        verificar.equal(
          await pagina.locator('[data-favorito]').first().getAttribute('aria-pressed'),
          'true',
        );
        await pagina.locator('[data-adicionar-carrinho]').first().click();
        verificar.match(await pagina.locator('#demo-estado').innerText(), /simula/i);
        await pagina.locator('#campo-busca').fill('software');
        await pagina.locator('#filtros-catalogo button[type=submit]').click();
        await pagina.waitForURL('**/catalogo?**');
        verificar.equal(await pagina.locator('.produto-cartao').count(), 1);
        await pagina.goto(`${url}/produto/piso-tatil-alerta`);
        await pagina.locator('[data-imagem-miniatura]').nth(1).click();
        verificar.match(
          await pagina.locator('#produto-detalhe-imagem-principal').getAttribute('src'),
          /alerta-2/,
        );
        await pagina.goto(`${url}/carrinho`);
        await pagina.locator('[data-quantidade="aumentar"]').first().click();
        verificar.equal(await pagina.locator('[data-quantidade-item]').first().innerText(), '3');
        await pagina.reload();
        verificar.equal(await pagina.locator('[data-quantidade-item]').first().innerText(), '2');
        await pagina.locator('#botao-limpar-carrinho').click();
        verificar.equal(await pagina.locator('[data-linha-carrinho]').count(), 0);
        verificar.match(await pagina.locator('#resumo-valor').innerText(), /0,00/);
        await pagina.goto(`${url}/cadastro`);
        verificar.equal(await pagina.locator('[data-campos-pj]').isVisible(), false);
        await pagina.locator('#pessoa-tipo').selectOption('pj');
        verificar.equal(await pagina.locator('[data-campos-pj]').isVisible(), true);
        await pagina.locator('#pessoa-tipo').selectOption('pf');
        verificar.equal(
          await pagina.locator('#perfil-comercial option[value=vendedor]').isDisabled(),
          true,
        );
        verificar.equal(await pagina.locator('input[type=email]').isDisabled(), true);
        verificar.equal(await pagina.locator('button[type=submit]').isDisabled(), true);
        await pagina.goto(`${url}/pagamento`);
        await pagina.route('https://viacep.com.br/ws/01001000/json/', (route) =>
          route.fulfill({
            json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' },
          }),
        );
        await pagina.locator('#botao-consultar-cep').click();
        await pagina.waitForFunction(() =>
          document.querySelector('#cep-estado').textContent.includes('São Paulo'),
        );
        await pagina.route('https://viacep.com.br/ws/01001000/json/', (route) => route.abort());
        await pagina.locator('#botao-consultar-cep').click();
        await pagina.waitForFunction(() =>
          document.querySelector('#cep-estado').textContent.includes('Não foi possível'),
        );
        await pagina.locator('#botao-contraste').click();
        verificar.equal(
          await pagina
            .locator('body')
            .evaluate((elemento) => elemento.classList.contains('modo-alto-contraste')),
          true,
        );
        await pagina.locator('#botao-aumentar-fonte').click();
        await pagina.locator('#botao-simplificado').click();
        await pagina.locator('#botao-leitura').click();
        await pagina.screenshot({
          path: `${resultados}/mvc-acessibilidade-${tamanho.name}.png`,
          fullPage: true,
        });
        if (tamanho.name === 'mobile') {
          await pagina.locator('#botao-menu-movel').click();
          verificar.equal(await pagina.locator('#menu-movel').isVisible(), true);
          await pagina.keyboard.press('Escape');
          verificar.equal(await pagina.locator('#menu-movel').isVisible(), false);
          await pagina.locator('.atalho-navegacao[href="#navegacao-principal"]').focus();
          await pagina.keyboard.press('Enter');
          verificar.equal(await pagina.locator('#menu-movel').isVisible(), true);
          verificar.equal(
            await pagina
              .locator('#menu-movel a')
              .first()
              .evaluate((elemento) => elemento === document.activeElement),
            true,
          );
        }
        await pagina.goto(url);
        await pagina.keyboard.press('Tab');
        verificar.equal(
          await pagina
            .locator('.atalho-navegacao')
            .first()
            .evaluate((elemento) => elemento === document.activeElement),
          true,
        );
        verificar.deepEqual(
          await pagina.evaluate(() => ({
            local: localStorage.length,
            session: sessionStorage.length,
            cookies: document.cookie,
          })),
          { local: 0, session: 0, cookies: '' },
        );
        verificar.deepEqual(erros, []);
        await pagina.close();
      }
    });
  } finally {
    await navegador.close();
  }
});
