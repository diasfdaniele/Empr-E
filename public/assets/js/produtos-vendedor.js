(() => {
  const formulario = document.getElementById('produto-formulario');
  if (!formulario) return;
  const entrada = document.getElementById('produto-imagens');
  const previa = document.getElementById('fotos-selecionadas');
  const erro = document.getElementById('fotos-erro');
  const salvar = document.getElementById('produto-salvar');
  const estadoFotos = document.getElementById('fotos-estado');
  const estadoEnvio = document.getElementById('produto-envio-estado');
  const urls = [];

  function limparPrevias() {
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    previa.replaceChildren();
  }

  function validarQuantidade() {
    const atuais = [...formulario.querySelectorAll('[name="removerImagens"]')];
    const mantidas = atuais.filter(campo => !campo.checked).length;
    const quantidade = mantidas + entrada.files.length;
    entrada.required = mantidas === 0;
    const invalida = quantidade > 6;
    erro.textContent = invalida ? 'O produto pode ter no máximo seis fotos.' : '';
    erro.hidden = !invalida;
    entrada.setAttribute('aria-invalid', String(invalida));
    entrada.setCustomValidity(invalida ? erro.textContent : '');
    estadoFotos.textContent = `${quantidade} de 6 fotos`;
    salvar.disabled = invalida;
    return !invalida;
  }

  entrada.addEventListener('change', () => {
    limparPrevias();
    const arquivos = [...entrada.files];
    if (arquivos.some(arquivo => arquivo.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type))) {
      entrada.value = '';
      erro.textContent = 'Selecione fotos JPEG, PNG ou WebP de até 5 MB cada.';
      erro.hidden = false;
      entrada.setAttribute('aria-invalid', 'true');
      entrada.setCustomValidity(erro.textContent);
      estadoFotos.textContent = 'Nenhuma nova foto selecionada.';
      salvar.disabled = false;
      return;
    }
    validarQuantidade();
    if (arquivos.length > 6) return;
    arquivos.forEach((arquivo, indice) => {
      const foto = document.createElement('div');
      foto.className = 'vendedor-foto';
      const imagem = document.createElement('img');
      const url = URL.createObjectURL(arquivo);
      urls.push(url);
      imagem.src = url;
      imagem.alt = arquivo.name;
      imagem.width = 160;
      imagem.height = 120;
      const rotulo = document.createElement('label');
      rotulo.htmlFor = `variacao-${indice}`;
      rotulo.textContent = `Variação da foto ${indice + 1}`;
      const nome = document.createElement('input');
      nome.id = rotulo.htmlFor;
      nome.name = 'variacoes';
      nome.className = 'campo-entrada';
      nome.required = true;
      nome.maxLength = 80;
      nome.value = arquivos.length === 1 ? 'Padrão' : `Variação ${indice + 1}`;
      foto.append(imagem, rotulo, nome);
      previa.append(foto);
    });
  });
  formulario.querySelectorAll('[name="removerImagens"]').forEach(campo => {
    campo.addEventListener('change', validarQuantidade);
  });
  formulario.addEventListener('submit', evento => {
    if (!validarQuantidade()) {
      evento.preventDefault();
      entrada.focus();
      return;
    }
    salvar.disabled = true;
    salvar.setAttribute('aria-busy', 'true');
    estadoEnvio.textContent = 'Salvando produto e fotos…';
  });
  document.querySelectorAll('[data-excluir-produto]').forEach(form => {
    form.addEventListener('submit', evento => {
      if (!window.confirm(`Excluir o produto "${form.dataset.excluirProduto}"?`)) evento.preventDefault();
    });
  });
  window.addEventListener('pageshow', () => {
    salvar.removeAttribute('aria-busy');
    estadoEnvio.textContent = '';
    validarQuantidade();
  });
  document.getElementById('produto-erro-servidor')?.focus();
})();