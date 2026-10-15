import { listarEmpresas } from '../models/empresa.js';

export function carregarOpcoes(requisicao, resposta, proximo) {
  resposta.locals.empresas = listarEmpresas().map((empresa) => empresa.nome);
  proximo();
}
