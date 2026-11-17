document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('filtros-catalogo');
  const resultados = document.getElementById('catalogo-resultados');
  const estado = document.getElementById('catalogo-filtro-estado');
  const erro = document.getElementById('catalogo-filtro-erro');
  const limpar = document.getElementById('catalogo-limpar');
  let temporizador;
  let requisicao;
  let versao = 0;

  async function atualizar() {
    const atual = versao;
    const controle = new AbortController();
    requisicao = controle;
    const url = new URL(formulario.action);
    for (const [nome, valor] of new FormData(formulario)) {
      if (String(valor).trim()) url.searchParams.set(nome, String(valor).trim());
    }

    resultados.setAttribute('aria-busy', 'true');
    estado.hidden = false;
    estado.textContent = 'Atualizando resultados…';
    erro.hidden = true;

    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`Resposta HTTP ${resposta.status}`);
      const pagina = new DOMParser().parseFromString(await resposta.text(), 'text/html');
      const novosResultados = pagina.getElementById('catalogo-resultados');
      const contagem = novosResultados?.querySelector('.catalogo__resultado');
      if (!novosResultados || !contagem) throw new Error('Resposta do catálogo inválida.');
      if (atual !== versao) return;

      resultados.replaceChildren(...novosResultados.childNodes);
      history.replaceState(null, '', url.pathname + url.search);
      estado.textContent = `${contagem.textContent.trim()}. Filtros atualizados.`;
    } catch (falha) {
      if (controle.signal.aborted || atual !== versao) return;
      console.error('Falha ao atualizar os filtros do catálogo:', falha);
      estado.textContent = 'Os resultados anteriores foram mantidos.';
      erro.textContent = 'Não foi possível atualizar os produtos. Tente novamente usando o botão Filtrar.';
      erro.hidden = false;
    } finally {
      if (atual === versao) resultados.setAttribute('aria-busy', 'false');
    }
  }

  function agendar(atraso) {
    clearTimeout(temporizador);
    requisicao?.abort();
    versao += 1;
    resultados.setAttribute('aria-busy', 'false');
    temporizador = setTimeout(atualizar, atraso);
  }

  formulario.addEventListener('input', (evento) => {
    if (evento.target.matches('input[type="search"]') && !evento.isComposing) agendar(350);
  });
  formulario.addEventListener('change', (evento) => {
    if (evento.target.matches('select')) agendar(0);
  });
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    agendar(0);
  });
  limpar.addEventListener('click', (evento) => {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    for (const campo of formulario.querySelectorAll('input, select')) {
      if (campo.type === 'hidden') campo.remove();
      else campo.value = '';
    }
    agendar(0);
  });
});
