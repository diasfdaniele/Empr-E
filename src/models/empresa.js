
import { supabase } from '../../config/db.js';

// Campos disponíveis na view pública.
const CAMPOS_EMPRESA_PUBLICA = `
  id_empresa,
  nome_fantasia,
  categoria_empresa,
  descricao,
  status_conta,
  site,
  logo_url
`;

// Converte os nomes do banco para os nomes utilizados nas views EJS.
function mapearEmpresa(empresa) {
  return {
    id: empresa.id_empresa,
    nomeFantasia: empresa.nome_fantasia,
    categoriaEmpresa:
      empresa.categoria_empresa || 'Setor não informado',
    descricao:
      empresa.descricao ||
      'Empresa parceira especializada em soluções de acessibilidade.',
    statusConta: empresa.status_conta,
    site: empresa.site || '',
    logoUrl: empresa.logo_url || null,
    imagem:
      empresa.logo_url || '/assets/img/placeholder-empresa.jpg'
  };
}

// Lista somente empresas ativas.
export async function listarEmpresasVendedoras(cliente = supabase) {
  const { data, error } = await cliente
    .from('empresas_publicas')
    .select(CAMPOS_EMPRESA_PUBLICA)
    .order('nome_fantasia', { ascending: true });

  if (error) {
    throw new Error(
      `Não foi possível carregar as empresas: ${error.message}`
    );
  }

  return (data ?? []).map(mapearEmpresa);
}

// Mantém compatibilidade com o middleware do catálogo.
export async function listarEmpresas(cliente = supabase) {
  return listarEmpresasVendedoras(cliente);
}

// Busca uma empresa ativa pelo ID.
export async function buscarEmpresa(id, cliente = supabase) {
  const idEmpresa = Number(id);

  if (!Number.isSafeInteger(idEmpresa) || idEmpresa < 1) {
    return null;
  }

  const { data, error } = await cliente
    .from('empresas_publicas')
    .select(CAMPOS_EMPRESA_PUBLICA)
    .eq('id_empresa', idEmpresa)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível consultar a empresa: ${error.message}`
    );
  }

  return data ? mapearEmpresa(data) : null;
}

export function selecionarEmpresasDestaque(empresas) {
  const comLogo = empresas.filter((empresa) => empresa.logoUrl);

  return comLogo.slice(0, 3);
}
