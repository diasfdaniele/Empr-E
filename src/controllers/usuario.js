import { renderizarPagina, exibirIndisponibilidade } from '../utils/apresentacao.js';

export function exibirCadastro(req, res) {
  renderizarPagina(res, 'cadastro', 'Criar conta | Empr-E');
}

export function exibirLogin(req, res) {
  renderizarPagina(res, 'login', 'Entrar | Empr-E');
}

export function exibirConta(req, res) {
  exibirIndisponibilidade(req, res);
}

export function exibirFavoritos(req, res) {
  exibirIndisponibilidade(req, res);
}

export function exibirAdministracao(req, res) {
  exibirIndisponibilidade(req, res);
}
