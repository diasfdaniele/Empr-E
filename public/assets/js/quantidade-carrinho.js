
document.addEventListener('DOMContentLoaded', () => {
    const campos = document.querySelectorAll(
        '[data-quantidade-carrinho]'
    );

    campos.forEach((campo) => {
        const formulario = campo.form;

        if (!formulario) return;

        campo.addEventListener('change', () => {
            const valorDigitado = campo.value.trim();
            const valor = Number(valorDigitado);
            const original = Number(
                campo.dataset.quantidadeOriginal
            );

            // Não envia se o valor não mudou.
            if (valorDigitado === '' || valor === original) {
                campo.value = String(original);
                return;
            }

            if (
                !Number.isInteger(valor) ||
                valor < 1 ||
                valor > 999
            ) {
                campo.value = String(original);
                campo.reportValidity();
                return;
            }

            // Informa ao controller que deve definir a quantidade.
            let acao = formulario.querySelector(
                'input[name="acao"]'
            );

            if (!acao) {
                acao = document.createElement('input');
                acao.type = 'hidden';
                acao.name = 'acao';
                formulario.appendChild(acao);
            }

            acao.value = 'definir';

            formulario.requestSubmit();
        });
    });
});
