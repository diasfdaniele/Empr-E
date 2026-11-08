document.addEventListener('DOMContentLoaded', () => {
 
  const inputCep = document.getElementById('cep');
  const btnConsultar = document.getElementById('botao-consultar-cep');
  const statusCep = document.getElementById('cep-estado');
  
  const inputLogradouro = document.getElementById('logradouro');
  const inputBairro = document.getElementById('bairro');
  const inputCidade = document.getElementById('cidade');
  const inputEstado = document.getElementById('estado');
  const inputNumero = document.getElementById('numero');

  async function buscarEnderecoPorCep() {
    const cepLimpo = inputCep.value.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      statusCep.textContent = 'Por favor, digite um CEP válido com 8 dígitos.';
      statusCep.style.color = '#d9534f';
      return;
    }

    statusCep.textContent = 'Buscando endereço...';
    statusCep.style.color = '#0275d8';

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dados = await resposta.json();

      if (dados.erro) {
        statusCep.textContent = 'CEP não encontrado. Preencha o endereço manualmente.';
        statusCep.style.color = '#d9534f';
        return;
      }

      inputLogradouro.value = dados.logradouro || '';
      inputBairro.value = dados.bairro || '';
      inputCidade.value = dados.localidade || '';
      inputEstado.value = dados.uf || '';

      statusCep.textContent = 'Endereço encontrado!';
      statusCep.style.color = '#5cb85c';

      if (inputNumero) {
        inputNumero.focus();
      }

    } catch (erro) {
      console.error('Erro ao consultar CEP:', erro);
      statusCep.textContent = 'Erro ao buscar o CEP. Verifique sua conexão e tente novamente.';
      statusCep.style.color = '#d9534f';
    }
  }

  if (btnConsultar) {
    btnConsultar.addEventListener('click', buscarEnderecoPorCep);
  }

  if (inputCep) {
    inputCep.addEventListener('blur', () => {
      const cepLimpo = inputCep.value.replace(/\D/g, '');
      if (cepLimpo.length === 8) {
        buscarEnderecoPorCep();
      }
    });
  }

  const selectMetodo = document.getElementById('metodo');
  const selectParcelas = document.getElementById('parcelas'); // Seleciona o campo de parcelas
  const painelCartao = document.getElementById('painel-cartao');
  const painelPix = document.getElementById('painel-pix');
  const painelBoleto = document.getElementById('painel-boleto');
  
  const inputsCartao = painelCartao ? painelCartao.querySelectorAll('input') : [];
  const pixQrImage = document.getElementById('pix-qr-image');
  const pixCodeTextarea = document.getElementById('pix-code');
  const boletoLinhaDigitavel = document.getElementById('boleto-linha-digitavel');

  function gerarChavePixAleatoria() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '00020126580014br.gov.bcb.pix0136';
    for (let i = 0; i < 40; i++) {
      randomString += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    randomString += '5204000053039865802BR5925LOJA_EXEMPLO_SIMULADO6009SAO_PAULO6304';
    return randomString;
  }

  function gerarBoletoFalso() {
    const bloco1 = Math.floor(10000 + Math.random() * 90000) + '.' + Math.floor(10000 + Math.random() * 90000);
    const bloco2 = Math.floor(10000 + Math.random() * 90000) + '.' + Math.floor(100000 + Math.random() * 900000);
    const bloco3 = Math.floor(10000 + Math.random() * 90000) + '.' + Math.floor(100000 + Math.random() * 900000);
    const bloco4 = Math.floor(1 + Math.random() * 8);
    const bloco5 = Math.floor(10000000000000 + Math.random() * 90000000000000);
    return `${bloco1} ${bloco2} ${bloco3} ${bloco4} ${bloco5}`;
  }

  function atualizarMetodoPagamento() {
    if (!selectMetodo) return;
    const metodoSelecionado = selectMetodo.value;

    if (painelCartao) painelCartao.hidden = true;
    if (painelPix) painelPix.hidden = true;
    if (painelBoleto) painelBoleto.hidden = true;
    
    inputsCartao.forEach(input => input.removeAttribute('required'));

    if (selectParcelas) {
      if (metodoSelecionado === 'pix' || metodoSelecionado === 'boleto') {
        selectParcelas.value = '1';  
        selectParcelas.disabled = true;  
      } else {
        selectParcelas.disabled = false;
      }
    }

    if (metodoSelecionado === 'cartao' && painelCartao) {
      painelCartao.hidden = false;
      inputsCartao.forEach(input => input.setAttribute('required', 'required'));
    } 
    else if (metodoSelecionado === 'pix' && painelPix) {
      painelPix.hidden = false;
      if (pixCodeTextarea && !pixCodeTextarea.value) {
        const payloadPix = gerarChavePixAleatoria();
        pixCodeTextarea.value = payloadPix;
        if (pixQrImage) {
          pixQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payloadPix)}`;
        }
      }
    } 
    else if (metodoSelecionado === 'boleto' && painelBoleto) {
      painelBoleto.hidden = false;
      if (boletoLinhaDigitavel && !boletoLinhaDigitavel.value) {
        boletoLinhaDigitavel.value = gerarBoletoFalso();
      }
    }
  }

  if (selectMetodo) {
    selectMetodo.addEventListener('change', atualizarMetodoPagamento);
    atualizarMetodoPagamento();
  }

  const btnCopiarPix = document.getElementById('btn-copiar-pix');
  if (btnCopiarPix && pixCodeTextarea) {
    btnCopiarPix.addEventListener('click', () => {
      pixCodeTextarea.select();
      navigator.clipboard.writeText(pixCodeTextarea.value).then(() => {
        btnCopiarPix.textContent = 'Código copiado!';
        setTimeout(() => {
          btnCopiarPix.textContent = 'Copiar código PIX';
        }, 3000);
      });
    });
  }
});