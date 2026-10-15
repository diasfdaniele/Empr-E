export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export function renderizarPagina(res, pagina, titulo, dados = {}) {
  res.render('estrutura', { pagina, titulo, formatarMoeda, ...dados });
}

export function exibirIndisponibilidade(
  req,
  res,
  status = 503,
  titulo = 'Área indisponível',
  mensagem = 'Esta área estará disponível após a implementação da autenticação e do banco de dados.',
) {
  res.status(status);
  renderizarPagina(res, 'indisponivel', `${titulo} | Empr-E`, {
    tituloPagina: titulo,
    mensagem,
  });
}
