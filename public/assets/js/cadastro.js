
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONTROLE DOS CAMPOS DA EMPRESA
    // ==========================================

    const tipoPessoa = document.getElementById('pessoa-tipo');
    const perfilComercial = document.getElementById('perfil-comercial');
    const camposEmpresa = document.querySelector('[data-campos-pj]');

    function atualizarFormulario() {
        const ehPessoaJuridica = tipoPessoa.value === 'pj';
        const desejaVender = perfilComercial.value === 'vendedor';

        const mostrarEmpresa = ehPessoaJuridica && desejaVender;

        perfilComercial.querySelector('[value="vendedor"]').disabled =
            !ehPessoaJuridica;

        if (!ehPessoaJuridica) {
            perfilComercial.value = 'comprador';
        }

        camposEmpresa.hidden = !mostrarEmpresa;
        camposEmpresa.disabled = !mostrarEmpresa;

        camposEmpresa.querySelectorAll('input').forEach((campo) => {
            campo.required = mostrarEmpresa;
        });
    }

    tipoPessoa.addEventListener('change', atualizarFormulario);
    perfilComercial.addEventListener('change', atualizarFormulario);

    atualizarFormulario();


    // ==========================================
    // 2. MÁSCARA DE CPF
    // ==========================================

    const campoCPF = document.getElementById('cpf-pessoa');

    function aplicarMascaraCPF(valor) {
        let numeros = valor.replace(/\D/g, '').substring(0, 11);

        numeros = numeros.replace(/^(\d{3})(\d)/, '$1.$2');
        numeros = numeros.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        numeros = numeros.replace(
            /^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/,
            '$1.$2.$3-$4'
        );

        return numeros;
    }

    if (campoCPF) {
        campoCPF.addEventListener('input', () => {
            campoCPF.value = aplicarMascaraCPF(campoCPF.value);
        });

        // Aplica a máscara também aos valores recuperados após erros.
        campoCPF.value = aplicarMascaraCPF(campoCPF.value);
    }


    // ==========================================
    // 3. MÁSCARA DE CNPJ
    // ==========================================

    const campoCNPJ = document.getElementById('cnpj');

    function aplicarMascaraCNPJ(valor) {
        let numeros = valor.replace(/\D/g, '').substring(0, 14);

        numeros = numeros.replace(/^(\d{2})(\d)/, '$1.$2');
        numeros = numeros.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        numeros = numeros.replace(
            /^(\d{2})\.(\d{3})\.(\d{3})(\d)/,
            '$1.$2.$3/$4'
        );
        numeros = numeros.replace(
            /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})$/,
            '$1.$2.$3/$4-$5'
        );

        return numeros;
    }

    if (campoCNPJ) {
        campoCNPJ.addEventListener('input', () => {
            campoCNPJ.value = aplicarMascaraCNPJ(campoCNPJ.value);
        });

        // Aplica a máscara também aos valores recuperados após erros.
        campoCNPJ.value = aplicarMascaraCNPJ(campoCNPJ.value);
    }


    // ==========================================
    // 4. MOSTRAR E OCULTAR SENHA
    // ==========================================

    const botoesSenha = document.querySelectorAll('[data-toggle-senha]');

    botoesSenha.forEach((botao) => {
        botao.addEventListener('click', () => {
            const idCampo = botao.dataset.toggleSenha;
            const campoSenha = document.getElementById(idCampo);

            if (!campoSenha) return;

            const senhaVisivel = campoSenha.type === 'text';

            campoSenha.type = senhaVisivel ? 'password' : 'text';

            botao.textContent = senhaVisivel ? 'Mostrar' : 'Ocultar';

            botao.setAttribute(
                'aria-label',
                senhaVisivel ? 'Mostrar senha' : 'Ocultar senha'
            );

            botao.setAttribute(
                'aria-pressed',
                senhaVisivel ? 'false' : 'true'
            );
        });
    });

});
