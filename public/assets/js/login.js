
document.addEventListener('DOMContentLoaded', () => {
    const campoSenha = document.getElementById('campo-senha');
    const botaoMostrarSenha = document.getElementById('botao-mostrar-senha');
    const iconeSenha = document.getElementById('icone-senha-oculta');

    if (!campoSenha || !botaoMostrarSenha) {
        return;
    }

    botaoMostrarSenha.addEventListener('click', () => {
        const mostrarSenha = campoSenha.type === 'password';

        // Alterna a visibilidade da senha.
        campoSenha.type = mostrarSenha ? 'text' : 'password';

        // Atualiza a acessibilidade do botão.
        botaoMostrarSenha.setAttribute(
            'aria-label',
            mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'
        );

        botaoMostrarSenha.setAttribute(
            'aria-pressed',
            String(mostrarSenha)
        );

        botaoMostrarSenha.title = mostrarSenha
            ? 'Ocultar senha'
            : 'Mostrar senha';

        // Atualiza o ícone.
        if (iconeSenha) {
            if (mostrarSenha) {
                iconeSenha.innerHTML = `
                    <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            } else {
                iconeSenha.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            }
        }
    });
});
