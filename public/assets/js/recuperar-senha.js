document.addEventListener('DOMContentLoaded', () => {
  const formularioEmail = document.getElementById('recuperacao-email-form');
  const formularioSenha = document.getElementById('recuperacao-senha-form');
  const codigo = document.getElementById('recuperacao-codigo');
  const senha = document.getElementById('recuperacao-senha');
  const confirmacao = document.getElementById('recuperacao-confirmacao');
  const erro = document.getElementById('recuperacao-erro');
  let codigoTeste = null;
  let expiraEm = 0;

  formularioEmail.hidden = false;

  formularioEmail.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!formularioEmail.reportValidity()) return;

    const aleatorio = crypto.getRandomValues(new Uint32Array(1))[0];
    codigoTeste = String(aleatorio % 1000000).padStart(6, '0');
    expiraEm = Date.now() + 10 * 60 * 1000;
    document.getElementById('recuperacao-codigo-exibido').textContent = codigoTeste;
    formularioEmail.hidden = true;
    formularioSenha.hidden = false;
    document.getElementById('recuperacao-etapa-titulo').focus();
  });

  function exibirErro(mensagem, campo) {
    erro.textContent = mensagem;
    erro.hidden = false;
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
  }

  for (const campo of [codigo, senha, confirmacao]) {
    campo.addEventListener('input', () => {
      campo.removeAttribute('aria-invalid');
      erro.hidden = true;
    });
  }

  formularioSenha.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!formularioSenha.reportValidity()) return;

    if (!codigoTeste || Date.now() >= expiraEm) {
      exibirErro('O código expirou. Recarregue a página para gerar outro código.', codigo);
      return;
    }
    if (codigo.value !== codigoTeste) {
      exibirErro('Código incorreto. Confira os 6 dígitos exibidos nesta tela.', codigo);
      return;
    }
    if (senha.value !== confirmacao.value) {
      exibirErro('As senhas de teste precisam ser iguais.', confirmacao);
      return;
    }

    codigoTeste = null;
    formularioSenha.reset();
    formularioEmail.reset();
    document.getElementById('recuperacao-codigo-exibido').textContent = '';
    formularioSenha.hidden = true;
    document.getElementById('recuperacao-concluida').hidden = false;
    document.getElementById('recuperacao-sucesso-titulo').focus();
  });

});
