import { renderizarPagina } from '../utils/apresentacao.js';
import { listarEmpresasVendedoras, selecionarEmpresasDestaque } from '../models/empresa.js';

export async function exibirInicio(req, res, next) {
  try {
    const empresas = await listarEmpresasVendedoras();
    return renderizarPagina(res, 'inicio', 'Empr-E | Marketplace de Acessibilidade', {
      empresasDestaque: selecionarEmpresasDestaque(empresas),
    });
  } catch (erro) {
    next(erro);
  }
}

export function exibirInstitucional(req, res) {
  renderizarPagina(res, 'institucional', 'Institucional | Empr-E');
}
