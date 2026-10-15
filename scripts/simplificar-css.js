import {
  readdir as listarArquivos,
  readFile as lerArquivo,
  writeFile as gravarArquivo,
  mkdir as criarPasta,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import analisarSeletor from 'postcss-selector-parser';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const nomesUsados = new Set();
async function coletar(pasta) {
  for (const entrada of await listarArquivos(pasta, { withFileTypes: true })) {
    const caminho = `${pasta}/${entrada.name}`;
    if (entrada.isDirectory()) await coletar(caminho);
    else if (/\.(ejs|js)$/.test(entrada.name)) {
      const texto = await lerArquivo(caminho, 'utf8');
      for (const token of texto.match(/[a-zA-Z_][a-zA-Z0-9_-]*/g) || []) nomesUsados.add(token);
    }
  }
}
await coletar(`${raiz}/src/views`);
await coletar(`${raiz}/public/assets/js`);
const relatorio = [];
for (const nomeArquivo of [
  'estilo.css',
  'catalogo.css',
  'detalhe-produto.css',
  'carrinho.css',
  'pagamento.css',
  'cadastro.css',
  'login.css',
  'conta.css',
]) {
  const caminho = `${raiz}/public/assets/css/${nomeArquivo}`;
  const original = await lerArquivo(caminho, 'utf8');
  const folha = postcss.parse(original, { from: caminho });
  let seletoresRemovidos = 0;
  folha.walkComments((comentario) => comentario.remove());
  folha.walkRules((regra) => {
    if (regra.parent.type === 'atrule' && /keyframes$/i.test(regra.parent.name)) return;
    const seletores = analisarSeletor().astSync(regra.selector);
    seletores.each((seletor) => {
      if (/:(is|where|has|not)\(/.test(seletor.toString())) return;
      let semUso = false;
      seletor.walkClasses((no) => {
        if (!nomesUsados.has(no.value)) semUso = true;
      });
      if (semUso) {
        seletor.remove();
        seletoresRemovidos += 1;
      }
    });
    if (!seletores.nodes.length) regra.remove();
    else regra.selector = seletores.toString();
  });
  folha.walkAtRules((regra) => {
    if (regra.nodes && !regra.nodes.length) regra.remove();
  });
  const animacoesUsadas = new Set();
  folha.walkDecls(/^(animation|animation-name)$/, (declaracao) => {
    for (const nome of declaracao.value.match(/[a-zA-Z_][a-zA-Z0-9_-]*/g) || []) animacoesUsadas.add(nome);
  });
  folha.walkAtRules(/keyframes$/, (regra) => {
    if (!animacoesUsadas.has(regra.params.trim())) regra.remove();
  });
  const simplificado =
    folha
      .toString()
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
      .trim() + '\n';
  await gravarArquivo(caminho, simplificado, 'utf8');
  relatorio.push({
    arquivo: nomeArquivo,
    bytesAntes: Buffer.byteLength(original),
    bytesDepois: Buffer.byteLength(simplificado),
    seletoresRemovidos,
  });
}
await criarPasta(`${raiz}/test-results`, { recursive: true });
await gravarArquivo(`${raiz}/test-results/css-audit.json`, JSON.stringify(relatorio, null, 2));
console.table(relatorio);
