
import {
  listarEmpresas,
  listarEmpresasVendedoras,
  buscarEmpresa
} from '../models/empresa.js';

import { renderizarPagina } from '../utils/apresentacao.js';
import { listarProdutos } from '../models/produto.js';

// Carrega as empresas disponíveis para os filtros do catálogo.
export async function carregarOpcoes(req, res, next) {
  try {
    const empresas = await listarEmpresas();

    res.locals.empresas = empresas.map(
      (empresa) => empresa.nomeFantasia
    );

    next();
  } catch (erro) {
    next(erro);
  }
}

// Página com todas as empresas parceiras ativas.
export async function exibirListaEmpresas(req, res) {
  try {
    const empresas = await listarEmpresasVendedoras();

    const setores = [
      ...new Set(
        empresas.map((empresa) => empresa.categoriaEmpresa)
      )
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return renderizarPagina(
      res,
      'empresas',
      'Empresas parceiras | Empr-E',
      { empresas, setores }
    );
  } catch (erro) {
    console.error('Erro ao renderizar a lista de empresas:', erro);

    return res.status(500).send(
      'Não foi possível carregar as empresas.'
    );
  }
}

// Página com os detalhes de uma empresa específica.
export async function exibirDetalhesEmpresa(req, res) {
    try {
        const empresa = await buscarEmpresa(req.params.id);

        if (!empresa) {
            return res.status(404).redirect('/empresas');
        }

        // Busca somente os produtos ativos vinculados a esta empresa.
        const produtos = await listarProdutos({
            empresaId: empresa.id
        });

        return renderizarPagina(
            res,
            'empresa',
            `${empresa.nomeFantasia} | Empr-E`,
            {
                empresa,
                produtos
            }
        );

    } catch (erro) {
        console.error(
            'Erro ao carregar detalhes da empresa:',
            erro
        );

        return res.status(500).send(
            'Não foi possível carregar os detalhes da empresa.'
        );
    }
}
