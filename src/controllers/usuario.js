import { renderizarPagina, exibirIndisponibilidade } from '../utils/apresentacao.js';

export function exibirCadastro(requisicao, resposta) {
  renderizarPagina(resposta, 'cadastro', 'Criar conta | Empr-E');
}

export function exibirLogin(requisicao, resposta) {
  renderizarPagina(resposta, 'login', 'Entrar | Empr-E');
}

export function exibirConta(requisicao, resposta) {
  exibirIndisponibilidade(requisicao, resposta);
}

export function exibirFavoritos(requisicao, resposta) {
  exibirIndisponibilidade(requisicao, resposta);
}

export function exibirAdministracao(requisicao, resposta) {
  exibirIndisponibilidade(requisicao, resposta);
}
