
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
