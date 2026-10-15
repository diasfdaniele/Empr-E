(() => {
  const corpo = document.body;
  const aviso = document.querySelector('#demo-estado');
  let timeoutId;

  function avisar(mensagem) {
    clearTimeout(timeoutId);
    aviso.hidden = false;
    aviso.textContent = mensagem;
    timeoutId = setTimeout(() => {
      aviso.hidden = true;
    }, 6000);
  }

  function iniciarMenu() {
    const botao = document.querySelector('#botao-menu-movel');
    const menu = document.querySelector('#menu-movel');
    function alternarMenu(aberto) {
      menu.hidden = !aberto;
      botao.setAttribute('aria-expanded', String(aberto));
      botao.setAttribute(
        'aria-label',
        aberto ? 'Fechar menu de navegação' : 'Abrir menu de navegação',
      );
    }
    botao.addEventListener('click', () => alternarMenu(menu.hidden));
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) alternarMenu(false);
    });
    document
      .querySelector('.atalho-navegacao[href="#navegacao-principal"]')
      .addEventListener('click', (event) => {
        if (getComputedStyle(botao).display !== 'none') {
          event.preventDefault();
          alternarMenu(true);
          menu.querySelector('a').focus();
        }
      });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        alternarMenu(false);
        botao.focus();
      }
    });
    matchMedia('(min-width: 1025px)').addEventListener('change', () => alternarMenu(false));
  }

  function iniciarAcessibilidade() {
    let tamanhoFonte = 16;
    function atualizarFonte() {
      const tamanho = tamanhoFonte + (corpo.classList.contains('modo-leitura') ? 2 : 0);
      document.documentElement.style.setProperty('--tamanho-fonte-base', `${tamanho}px`);
    }
    const modos = {
      'botao-contraste': 'modo-alto-contraste',
      'botao-simplificado': 'modo-simplificado',
      'botao-leitura': 'modo-leitura',
    };
    for (const [id, classe] of Object.entries(modos)) {
      document.getElementById(id).addEventListener('click', (event) => {
        const ativo = corpo.classList.toggle(classe);
        event.currentTarget.setAttribute('aria-pressed', String(ativo));
        atualizarFonte();
      });
    }
    for (const [id, alteracao] of [
      ['botao-aumentar-fonte', 2],
      ['botao-diminuir-fonte', -2],
    ]) {
      document.getElementById(id).addEventListener('click', () => {
        tamanhoFonte = Math.max(14, Math.min(24, tamanhoFonte + alteracao));
        atualizarFonte();
      });
    }
  }

  function iniciarSimulacoes() {
    for (const formulario of document.querySelectorAll('[data-formulario-desabilitado]')) {
      formulario.addEventListener('submit', (event) => {
        event.preventDefault();
        avisar('Operação indisponível nesta versão demonstrativa.');
      });
    }
    for (const botao of document.querySelectorAll('[data-favorito]')) {
      botao.addEventListener('click', () => {
        const ativo = botao.getAttribute('aria-pressed') !== 'true';
        botao.setAttribute('aria-pressed', String(ativo));
        botao.classList.toggle('produto-cartao__favorito-icone--ativo', ativo);
        botao.setAttribute(
          'aria-label',
          ativo ? 'Remover favorito da simulação' : 'Favoritar na simulação',
        );
        avisar(ativo ? 'Favorito marcado apenas nesta página.' : 'Favorito removido da simulação.');
      });
    }
    const adicoes = new Map();
    for (const botao of document.querySelectorAll('[data-adicionar-carrinho]')) {
      botao.addEventListener('click', () => {
        const chave = `${botao.dataset.adicionarCarrinho}:${botao.dataset.variacao || ''}`;
        const quantidade = (adicoes.get(chave) || 0) + 1;
        adicoes.set(chave, quantidade);
        avisar(
          `Adição simulada: ${quantidade} unidade(s). O carrinho de exemplo é independente; esta seleção se perde ao navegar.`,
        );
      });
    }
  }

  function iniciarGaleria() {
    const miniaturas = document.querySelectorAll('[data-imagem-miniatura]');
    for (const botao of miniaturas) {
      botao.addEventListener('click', () => {
        const imagem = document.querySelector('#produto-detalhe-imagem-principal');
        imagem.src = botao.dataset.imagemMiniatura;
        imagem.alt = `${document.querySelector('.produto-detalhe__titulo').textContent} — ${botao.dataset.variacao}`;
        document.querySelector('#variacao-estado').textContent =
          `Variação: ${botao.dataset.variacao}`;
        document.querySelector('[data-adicionar-carrinho]').dataset.variacao =
          botao.dataset.variacao;
        for (const miniatura of miniaturas) {
          miniatura.setAttribute('aria-pressed', String(miniatura === botao));
          miniatura.classList.toggle('produto-detalhe__miniatura--ativo', miniatura === botao);
        }
      });
    }
  }

  function iniciarCarrinho() {
    const lista = document.querySelector('#lista-carrinho');
    if (!lista) return;
    const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    function atualizarResumo() {
      let quantidade = 0;
      let centavos = 0;
      for (const linha of lista.querySelectorAll('[data-linha-carrinho]')) {
        const unidades = Number(linha.querySelector('[data-quantidade-item]').textContent);
        quantidade += unidades;
        if (linha.dataset.compra === 'true')
          centavos += unidades * Math.round(Number(linha.dataset.preco) * 100);
        linha.querySelector('[data-quantidade="diminuir"]').disabled = unidades <= 1;
        linha.querySelector('[data-quantidade="aumentar"]').disabled = unidades >= 99;
      }
      document.querySelector('#resumo-quantidade').textContent = String(quantidade);
      document.querySelector('#resumo-valor').textContent = moeda.format(centavos / 100);
    }
    lista.addEventListener('click', (event) => {
      const botao = event.target.closest('button');
      const linha = botao?.closest('[data-linha-carrinho]');
      if (!linha) return;
      if (botao.hasAttribute('data-remover')) linha.remove();
      if (botao.dataset.quantidade) {
        const contador = linha.querySelector('[data-quantidade-item]');
        const alteracao = botao.dataset.quantidade === 'aumentar' ? 1 : -1;
        contador.textContent = String(
          Math.max(1, Math.min(99, Number(contador.textContent) + alteracao)),
        );
      }
      atualizarResumo();
    });
    document.querySelector('#botao-limpar-carrinho').addEventListener('click', () => {
      const mensagem = document.createElement('p');
      mensagem.textContent = 'Carrinho de exemplo vazio.';
      lista.replaceChildren(mensagem);
      atualizarResumo();
      avisar('Exemplo limpo. Os itens iniciais voltam ao navegar ou recarregar.');
    });
    atualizarResumo();
  }

  function iniciarTipoPessoa() {
    const pessoa = document.querySelector('#pessoa-tipo');
    if (!pessoa) return;
    function atualizarTipo() {
      const juridica = pessoa.value === 'pj';
      for (const grupo of document.querySelectorAll('[data-campos-pj]')) grupo.hidden = !juridica;
      const vendedor = document.querySelector('#perfil-comercial option[value="vendedor"]');
      if (vendedor) {
        vendedor.disabled = !juridica;
        if (!juridica) document.querySelector('#perfil-comercial').value = 'comprador';
      }
    }
    pessoa.addEventListener('change', atualizarTipo);
    atualizarTipo();
  }

  function iniciarConsultaCep() {
    const botao = document.querySelector('#botao-consultar-cep');
    if (!botao) return;
    botao.addEventListener('click', async () => {
      const resultado = document.querySelector('#cep-estado');
      botao.disabled = true;
      resultado.textContent = 'Consultando CEP de exemplo...';
      try {
        const response = await fetch('https://viacep.com.br/ws/01001000/json/', {
          signal: AbortSignal.timeout(5000),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('Consulta indisponível');
        const endereco = await response.json();
        if (endereco.erro || !endereco.localidade) throw new Error('CEP não encontrado');
        resultado.textContent = `${endereco.logradouro || ''}, ${endereco.bairro || ''} — ${endereco.localidade}/${endereco.uf}. Consulta de exemplo, sem pedido.`;
      } catch {
        resultado.textContent =
          'Não foi possível consultar o CEP. Nenhum dado foi salvo; tente novamente.';
      } finally {
        botao.disabled = false;
      }
    });
  }

  iniciarMenu();
  iniciarAcessibilidade();
  iniciarSimulacoes();
  iniciarGaleria();
  iniciarCarrinho();
  iniciarTipoPessoa();
  iniciarConsultaCep();

  window.addEventListener('load', () => {
    if (window.VLibras?.Widget) {
      try {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
      } catch {
        avisar('VLibras temporariamente indisponível.');
      }
    }
  });
})();
