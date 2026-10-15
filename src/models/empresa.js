import { identificador } from '../utils/validacao.js';

export class Empresa {
  constructor({ id, nome }) {
    this.id = identificador(id, 'Empresa');
    this.nome = identificador(nome, 'Nome da empresa');
    Object.freeze(this);
  }
}

const empresas = Object.freeze([
  new Empresa({ id: 'klinker', nome: 'Klinker' }),
  new Empresa({ id: 'acessify', nome: 'Acessify' }),
]);

export function listarEmpresas() {
  return [...empresas];
}

export function buscarEmpresa(id) {
  return empresas.find((empresa) => empresa.id === id);
}
