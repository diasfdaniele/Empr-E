export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export function renderizarPagina(resposta, pagina, titulo, dados = {}) {
  resposta.render('estrutura', { pagina, titulo, formatarMoeda, ...dados });
}

export function exibirIndisponibilidade(
  requisicao,
  resposta,
  status = 503,
  titulo = 'Área indisponível',
  mensagem = 'Esta área estará disponível após a implementação da autenticação e do banco de dados.',
) {
  resposta.status(status);
  renderizarPagina(resposta, 'indisponivel', `${titulo} | Empr-E`, {
    tituloPagina: titulo,
    mensagem,
  });
}
