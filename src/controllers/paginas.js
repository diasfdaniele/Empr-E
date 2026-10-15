import { renderizarPagina } from '../utils/apresentacao.js';

export function exibirInicio(req, res) {
  renderizarPagina(res, 'inicio', 'Empr-E | Marketplace de Acessibilidade');
}

export function exibirInstitucional(req, res) {
  renderizarPagina(res, 'institucional', 'Institucional | Empr-E');
}
