
(() => {
  const corpo = document.body;
  const aviso = document.querySelector('#demo-estado');
  let timeoutId;

  // =========================================================
  // Avisos gerais da interface
  // =========================================================

  function avisar(mensagem) {
    if (!aviso) return;

    clearTimeout(timeoutId);

    aviso.hidden = false;
    aviso.textContent = mensagem;

    timeoutId = setTimeout(() => {
      aviso.hidden = true;
    }, 6000);
  }

  // =========================================================
  // Menu de navegação móvel
  // =========================================================

  function iniciarMenu() {
    const botao = document.querySelector('#botao-menu-movel');
    const menu = document.querySelector('#menu-movel');

    if (!botao || !menu) return;

    function alternarMenu(aberto) {
      menu.hidden = !aberto;

      botao.setAttribute('aria-expanded', String(aberto));
      botao.setAttribute(
        'aria-label',
        aberto
          ? 'Fechar menu de navegação'
          : 'Abrir menu de navegação',
      );
    }

    botao.addEventListener('click', () => {
      alternarMenu(menu.hidden);
    });

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        alternarMenu(false);
      }
    });

    const atalho = document.querySelector(
      '.atalho-navegacao[href="#navegacao-principal"]',
    );

    if (atalho) {
      atalho.addEventListener('click', (event) => {
        if (getComputedStyle(botao).display !== 'none') {
          event.preventDefault();

          alternarMenu(true);
          menu.querySelector('a')?.focus();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        alternarMenu(false);
        botao.focus();
      }
    });

    if (window.matchMedia) {
      window
        .matchMedia('(min-width: 1025px)')
        .addEventListener('change', () => {
          alternarMenu(false);
        });
    }
  }

  // =========================================================
  // Recursos de acessibilidade
  // =========================================================

  
function iniciarAcessibilidade() {
  let tamanhoFonte = 16;

  function atualizarFonte() {
    const tamanho =
      tamanhoFonte +
      (corpo.classList.contains('modo-leitura') ? 2 : 0);

    document.documentElement.style.setProperty(
      '--tamanho-fonte-base',
      `${tamanho}px`
    );
  }

  const modos = {
    'botao-contraste': 'modo-alto-contraste',
    'botao-simplificado': 'modo-simplificado',
    'botao-leitura': 'modo-leitura'
  };

  for (const [id, classe] of Object.entries(modos)) {
    const botao = document.getElementById(id);

    if (!botao) {
      console.warn(`Botão não encontrado: #${id}`);
      continue;
    }

    botao.addEventListener('click', () => {
      const ativo = corpo.classList.toggle(classe);

      botao.setAttribute('aria-pressed', String(ativo));
      atualizarFonte();
    });
  }

  const controlesFonte = [
    ['botao-aumentar-fonte', 2],
    ['botao-diminuir-fonte', -2]
  ];

  for (const [id, alteracao] of controlesFonte) {
    const botao = document.getElementById(id);

    if (!botao) {
      console.warn(`Botão não encontrado: #${id}`);
      continue;
    }

    botao.addEventListener('click', () => {
      tamanhoFonte = Math.max(
        14,
        Math.min(24, tamanhoFonte + alteracao)
      );

      atualizarFonte();
    });
  }

  atualizarFonte();
}



  // =========================================================
  // Carrinho demonstrativo
  // =========================================================

  function iniciarCarrinho() {
    const lista = document.querySelector('#lista-carrinho');

    if (!lista) return;

    const botaoLimpar = document.querySelector(
      '#botao-limpar-carrinho',
    );

    const elementoQuantidade = document.querySelector(
      '#resumo-quantidade',
    );

    const elementoValor = document.querySelector(
      '#resumo-valor',
    );

    const moeda = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    function atualizarResumo() {
      let quantidadeTotal = 0;
      let valorCentavos = 0;

      const linhas = lista.querySelectorAll(
        '[data-linha-carrinho]',
      );

      for (const linha of linhas) {
        const contador = linha.querySelector(
          '[data-quantidade-item]',
        );

        if (!contador) continue;

        const unidades = Number(contador.textContent) || 1;

        quantidadeTotal += unidades;

        // Mantém o cálculo apenas para itens marcados como compra.
        if (linha.dataset.compra === 'true') {
          const preco = Number(linha.dataset.preco) || 0;

          valorCentavos +=
            unidades * Math.round(preco * 100);
        }

        const diminuir = linha.querySelector(
          '[data-quantidade="diminuir"]',
        );

        const aumentar = linha.querySelector(
          '[data-quantidade="aumentar"]',
        );

        if (diminuir) {
          diminuir.disabled = unidades <= 1;
        }

        if (aumentar) {
          aumentar.disabled = unidades >= 999;
        }
      }

      if (elementoQuantidade) {
        elementoQuantidade.textContent =
          String(quantidadeTotal);
      }

      if (elementoValor) {
        elementoValor.textContent =
          moeda.format(valorCentavos / 100);
      }
    }

    lista.addEventListener('click', (event) => {
      const botao = event.target.closest('button');

      if (!botao) return;

      const linha = botao.closest('[data-linha-carrinho]');

      if (!linha) return;

      // Remove apenas a linha da demonstração atual.
      if (botao.hasAttribute('data-remover')) {
        linha.remove();
      }

      // Ajusta a quantidade local da demonstração.
      if (botao.dataset.quantidade) {
        const contador = linha.querySelector(
          '[data-quantidade-item]',
        );

        if (contador) {
          const alteracao =
            botao.dataset.quantidade === 'aumentar' ? 1 : -1;

          const atual = Number(contador.textContent) || 1;

          contador.textContent = String(
            Math.max(1, Math.min(999, atual + alteracao)),
          );
        }
      }

      atualizarResumo();
    });

    if (botaoLimpar) {
      botaoLimpar.addEventListener('click', () => {
        const mensagem = document.createElement('p');

        mensagem.textContent = 'Carrinho de exemplo vazio.';

        lista.replaceChildren(mensagem);

        atualizarResumo();

        avisar(
          'Exemplo limpo. Os itens iniciais voltam ao navegar ou recarregar.',
        );
      });
    }

    atualizarResumo();
  }

  // =========================================================
  // Cadastro: pessoa física ou jurídica
  // =========================================================

  function iniciarTipoPessoa() {
    const pessoa = document.querySelector('#pessoa-tipo');

    if (!pessoa) return;

    const perfilComercial = document.querySelector(
      '#perfil-comercial',
    );

    function atualizarTipo() {
      const juridica = pessoa.value === 'pj';

      for (const grupo of document.querySelectorAll(
        '[data-campos-pj]',
      )) {
        grupo.hidden = !juridica;
      }

      const opcaoVendedor = perfilComercial?.querySelector(
        'option[value="vendedor"]',
      );

      if (opcaoVendedor) {
        opcaoVendedor.disabled = !juridica;

        if (!juridica && perfilComercial.value === 'vendedor') {
          perfilComercial.value = 'comprador';
        }
      }
    }

    pessoa.addEventListener('change', atualizarTipo);

    atualizarTipo();
  }

  // =========================================================
  // Consulta demonstrativa de CEP
  // =========================================================

  function iniciarConsultaCep() {
    const botao = document.querySelector('#botao-consultar-cep');

    if (!botao) return;

    const resultado = document.querySelector('#cep-estado');

    if (!resultado) return;

    botao.addEventListener('click', async () => {
      botao.disabled = true;
      resultado.textContent = 'Consultando CEP de exemplo...';

      try {
        const response = await fetch(
          'https://viacep.com.br/ws/01001000/json/',
          {
            signal: AbortSignal.timeout(5000),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          },
        );

        if (!response.ok) {
          throw new Error('Consulta indisponível');
        }

        const endereco = await response.json();

        if (endereco.erro || !endereco.localidade) {
          throw new Error('CEP não encontrado');
        }

        resultado.textContent =
          `${endereco.logradouro || ''}, ` +
          `${endereco.bairro || ''} — ` +
          `${endereco.localidade}/${endereco.uf}. ` +
          'Consulta de exemplo, sem pedido.';
      } catch {
        resultado.textContent =
          'Não foi possível consultar o CEP. ' +
          'Nenhum dado foi salvo; tente novamente.';
      } finally {
        botao.disabled = false;
      }
    });
  }

  // =========================================================
  // Inicialização geral
  // =========================================================

  iniciarMenu();
  iniciarAcessibilidade();
  iniciarSimulacoes();
  iniciarCarrinho();
  iniciarTipoPessoa();
  iniciarConsultaCep();

  // =========================================================
  // VLibras
  // =========================================================

  window.addEventListener('load', () => {
    if (window.VLibras?.Widget) {
      try {
        new window.VLibras.Widget(
          'https://vlibras.gov.br/app',
        );
      } catch {
        avisar('VLibras temporariamente indisponível.');
      }
    }
  });
})();
