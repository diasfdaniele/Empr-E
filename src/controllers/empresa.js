import { listarEmpresas } from '../models/empresa.js';

export function carregarOpcoes(req, res, next) {
  res.locals.empresas = listarEmpresas().map((empresa) => empresa.nome);
  next();
}
