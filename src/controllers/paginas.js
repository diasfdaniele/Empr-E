import { renderizarPagina } from '../utils/apresentacao.js';

export function exibirInicio(requisicao, resposta) {
  renderizarPagina(resposta, 'inicio', 'Empr-E | Marketplace de Acessibilidade');
}

export function exibirInstitucional(requisicao, resposta) {
  renderizarPagina(resposta, 'institucional', 'Institucional | Empr-E');
}
