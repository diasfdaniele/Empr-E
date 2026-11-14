import { identificador } from '../utils/validacao.js';
import { supabase } from '../../config/db.js';

export class Empresa {
  constructor({ id, nome, categoriaEmpresa, descricao, statusConta, site, imagem }) {
    this.id = identificador(id, 'Empresa');
    this.nome = identificador(nome, 'Nome da empresa');
    this.categoriaEmpresa = categoriaEmpresa || 'Setor não informado';
    this.descricao = descricao || 'Empresa parceira especializada em soluções de acessibilidade.';
    this.statusConta = statusConta || 'Ativo';
    this.site = site || '';
    this.imagem = imagem || `/assets/img/${id}.jpg`;
    Object.freeze(this);
  }
}

const empresas = Object.freeze([
  new Empresa({ 
    id: 'klinker', 
    nome: 'Klinker',
    categoriaEmpresa: 'Mobilidade e Sinalização',
    descricao: 'Especializada em pisos táteis e sinalização acessível para pessoas com deficiência visual.',
    statusConta: 'Ativo',
    site: 'www.klinker.com.br',
    imagem: '/assets/img/klinker.jpg'
  }),
  new Empresa({ 
    id: 'acessify', 
    nome: 'Acessify',
    categoriaEmpresa: 'Acessibilidade Digital',
    descricao: 'Empresa especializada em soluções de acessibilidade digital para empresas.',
    statusConta: 'Ativo',
    site: 'www.acessify.com.br',
    imagem: '/assets/img/acessify.jpg'
  }),
]);

export function listarEmpresas() {
  return [...empresas];
}

export function buscarEmpresa(id) {
  return empresas.find((empresa) => empresa.id === id);
}

export async function listarEmpresasVendedoras(cliente = supabase) {
  const { data, error } = await cliente
    .from('empresas_publicas')
    .select('id_empresa, nome_fantasia, logo_url, categoria_empresa')
    .order('nome_fantasia', { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar as empresas vendedoras: ${error.message}`);
  }

  return (data ?? []).map((empresa) => ({
    id: empresa.id_empresa,
    nomeFantasia: empresa.nome_fantasia,
    logoUrl: empresa.logo_url,
    categoriaEmpresa: empresa.categoria_empresa || 'Setor não informado',
  }));
}

export function selecionarEmpresasDestaque(empresas) {
  const ehKlinker = (empresa) => /\bklinker\b/i.test(empresa.nomeFantasia);
  const comLogo = empresas.filter((empresa) => empresa.logoUrl).sort((a, b) =>
    a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')
  );
  const klinker = comLogo.find(ehKlinker) ?? empresas.find(ehKlinker);
  return [
    ...(klinker ? [klinker] : []),
    ...comLogo.filter((empresa) => !ehKlinker(empresa)),
  ].slice(0, 2);
}