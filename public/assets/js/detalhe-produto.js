
(() => {
    const imagemPrincipal = document.querySelector(
        '#produto-detalhe-imagem-principal'
    );

    const miniaturas = document.querySelectorAll(
        '[data-imagem-miniatura][data-variacao]'
    );

    const campoVariacao = document.querySelector(
        '#variacao-selecionada'
    );

    const estadoVariacao = document.querySelector(
        '#variacao-estado'
    );

    const tituloProduto = document.querySelector(
        '.produto-detalhe__titulo'
    );

    if (
        !imagemPrincipal ||
        !campoVariacao ||
        !estadoVariacao ||
        miniaturas.length === 0
    ) {
        return;
    }

    for (const botao of miniaturas) {
        botao.addEventListener('click', () => {
            const imagem = botao.dataset.imagemMiniatura;
            const variacao = botao.dataset.variacao;

            if (!imagem || !variacao) return;

            imagemPrincipal.src = imagem;
            imagemPrincipal.alt =
                `${tituloProduto?.textContent.trim() || 'Produto'} — ${variacao}`;

            campoVariacao.value = variacao;
            estadoVariacao.textContent =
                `Tipo selecionado: ${variacao}`;

            for (const outraMiniatura of miniaturas) {
                const selecionada = outraMiniatura === botao;

                outraMiniatura.setAttribute(
                    'aria-pressed',
                    String(selecionada)
                );

                outraMiniatura.classList.toggle(
                    'produto-detalhe__miniatura--ativo',
                    selecionada
                );
            }
        });
    }
})();
