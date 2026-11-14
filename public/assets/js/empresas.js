document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('filtros-empresas');
  const busca = document.getElementById('empresa-busca');
  const setor = document.getElementById('empresa-setor');
  const ordenacao = document.getElementById('empresa-ordenacao');
  const grade = document.getElementById('empresas-grade');
  const resultado = document.getElementById('empresas-resultado');
  const semResultados = document.getElementById('empresas-sem-resultados');

  if (!formulario || !busca || !setor || !ordenacao || !grade || !resultado || !semResultados) {
    return;
  }

  const cartoes = [...grade.querySelectorAll('[data-empresa-card]')];
  const normalizar = (valor) => String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  function aplicarFiltros() {
    const termo = normalizar(busca.value);
    const setorSelecionado = normalizar(setor.value);
    let quantidade = 0;

    for (const cartao of cartoes) {
      const correspondeNome = normalizar(cartao.dataset.nome).includes(termo);
      const correspondeSetor = !setorSelecionado ||
        normalizar(cartao.dataset.setor) === setorSelecionado;
      const visivel = correspondeNome && correspondeSetor;

      cartao.classList.toggle('empresa-cartao--oculta', !visivel);
      if (visivel) quantidade += 1;
    }

    const direcao = ordenacao.value === 'za' ? -1 : 1;
    cartoes
      .slice()
      .sort((a, b) => direcao * a.dataset.nome.localeCompare(
        b.dataset.nome,
        'pt-BR',
        { sensitivity: 'base', numeric: true },
      ))
      .forEach((cartao) => grade.append(cartao));

    resultado.textContent = `${quantidade} ${
      quantidade === 1 ? 'empresa encontrada' : 'empresas encontradas'
    }`;
    semResultados.hidden = quantidade !== 0;
  }

  formulario.addEventListener('input', aplicarFiltros);
  formulario.addEventListener('change', aplicarFiltros);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    aplicarFiltros();
  });
  formulario.addEventListener('reset', () => setTimeout(aplicarFiltros, 0));

  aplicarFiltros();
});
