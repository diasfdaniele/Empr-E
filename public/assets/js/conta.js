
document.addEventListener('DOMContentLoaded', () => {

    // Seleciona TODOS os formulários de endereço.
    const formularios = document.querySelectorAll('[data-cep-form]');

    formularios.forEach((formulario) => {

        const campoCep = formulario.querySelector('[name="cep"]');
        const campoLogradouro = formulario.querySelector('[name="logradouro"]');
        const campoBairro = formulario.querySelector('[name="bairro"]');
        const campoCidade = formulario.querySelector('[name="cidade"]');
        const campoEstado = formulario.querySelector('[name="estado"]');

        // Cada formulário terá sua própria mensagem.
        let mensagem = formulario.querySelector('.cep-mensagem');

        if (!mensagem) {
            mensagem = document.createElement('small');
            mensagem.className = 'cep-mensagem d-block mt-1';
            campoCep.insertAdjacentElement('afterend', mensagem);
        }

        if (!campoCep) return;

        campoCep.addEventListener('blur', async () => {

            const cep = campoCep.value.replace(/\D/g, '');

            mensagem.textContent = '';
            mensagem.style.color = '';

            if (cep.length !== 8) {
                if (cep.length > 0) {
                    mensagem.textContent = 'Digite um CEP com 8 números.';
                    mensagem.style.color = 'red';
                }
                return;
            }

            mensagem.textContent = 'Consultando CEP...';

            try {

                const resposta = await fetch(
                    `https://viacep.com.br/ws/${cep}/json/`
                );

                if (!resposta.ok) {
                    throw new Error('Falha na consulta.');
                }

                const dados = await resposta.json();

                if (dados.erro) {
                    throw new Error('CEP não encontrado.');
                }

                campoLogradouro.value = dados.logradouro || '';
                campoBairro.value = dados.bairro || '';
                campoCidade.value = dados.localidade || '';
                campoEstado.value = dados.uf || '';

                mensagem.textContent = 'CEP localizado com sucesso!';
                mensagem.style.color = 'green';

            } catch (erro) {

                mensagem.textContent = erro.message === 'CEP não encontrado.'
                    ? erro.message
                    : 'Não foi possível consultar o CEP.';

                mensagem.style.color = 'red';

            }

        });

        formulario.addEventListener('submit', (evento) => {

            const cep = campoCep.value.replace(/\D/g, '');

            if (cep.length !== 8) {
                evento.preventDefault();

                mensagem.textContent = 'Informe um CEP válido.';
                mensagem.style.color = 'red';

                campoCep.focus();
            }

        });

    });

});
