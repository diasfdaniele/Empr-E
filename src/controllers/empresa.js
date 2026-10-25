//Controller empresa
import { listarEmpresas } from '../models/empresa.js';
import { supabase } from '../../config/db.js';

export class Empresa {
  constructor({
    id,
    usuarioId = null,
    cnpj,
    razaoSocial,
    nomeFantasia,
    statusConta,
    inscricaoEstadual = null,
    categoriaEmpresa = null,
    tipoEmpresa = null,
    descricao = null,
    site = null,
  }) {
    const idNumerico = Number(id);

    if (!Number.isSafeInteger(idNumerico) || idNumerico < 1) {
      throw new TypeError('ID da empresa inválido.');
    }

    this.id = idNumerico;
    this.usuarioId =
      usuarioId === null ? null : Number(usuarioId);
    this.cnpj = cnpj;
    this.razaoSocial = razaoSocial;
    this.nomeFantasia = nomeFantasia;
    this.statusConta = statusConta;
    this.inscricaoEstadual = inscricaoEstadual;
    this.categoriaEmpresa = categoriaEmpresa;
    this.tipoEmpresa = tipoEmpresa;
    this.descricao = descricao;
    this.site = site;

    Object.freeze(this);
  }

  get podeVender() {
    return this.statusConta === 'Ativo';
  }
}

export async function buscarEmpresaPorUsuarioId(usuarioId, cliente = supabase) {
  const { data, error } = await cliente
    .from('empresas')
    .select('*')
    .eq('id_usuario', usuarioId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar empresa: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return new Empresa({
    id: data.id_empresa,
    usuarioId: data.id_usuario,
    cnpj: data.cnpj,
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia,
    statusConta: data.status_conta,
    inscricaoEstadual: data.inscricao_estadual,
    categoriaEmpresa: data.categoria_empresa,
    tipoEmpresa: data.tipo_empresa,
    descricao: data.descricao,
    site: data.site,
  });
}

export function carregarOpcoes(req, res, next) {
  res.locals.empresas = listarEmpresas().map((empresa) => empresa.nome);
  next();
}