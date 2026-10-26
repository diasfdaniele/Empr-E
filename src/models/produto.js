//Model produto
import { supabase } from '../../config/db.js';

const IMAGEM_PADRAO = '/assets/img/produto-padrao.png';

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function adaptarProduto(registro) {
    if (!registro) return null;

    return {
        id: registro.id_produto,
        nome: registro.nome_produto,
        descricao: registro.descricao,
        preco: Number(registro.preco_unitario),

        empresaId: registro.fk_vendedor,
        categoriaId: registro.fk_categoria,

        empresa: {
            id: registro.empresas?.id_empresa,
            nome: registro.empresas?.nome_fantasia
        },

        categoria: {
            id: registro.categorias?.id_categoria,
            nome: registro.categorias?.nome_categoria
        },

        unidade: 'unidade',
        modalidade: registro.tipo_compra,

        get nomeModalidade() {
            const modalidade = String(this.modalidade ?? '')
                .trim()
                .toLowerCase();

            if (modalidade === 'compra' ||
                modalidade === 'compra imediata') {
                return 'Compra imediata';
            }

            if (modalidade === 'projeto' ||
                modalidade === 'projeto personalizado') {
                return 'Projeto personalizado';
            }

            return this.modalidade || 'Não informada';
        },

        imagens: [IMAGEM_PADRAO],
        variacoes: ['Padrão'],
        variantes: [{
            variacao: 'Padrão',
            imagem: IMAGEM_PADRAO
        }]
    };
}

export const faixasPreco = Object.freeze({
    'ate-100': [0, 100],
    '100-500': [100, 500],
    '500-1000': [500, 1000],
    '1000-5000': [1000, 5000],
    '5000-plus': [5000, Infinity]
});

export async function listarCategorias() {
    const { data, error } = await supabase
        .from('categorias')
        .select('id_categoria, nome_categoria')
        .order('nome_categoria');

    if (error) throw error;

    return data ?? [];
}

// Associa cada imagem e seu nome de variação ao produto.
// Mantém "imagens" como array de URLs para compatibilidade
// com as telas que já usam produto.imagens.
async function associarImagens(produtos) {
    if (!produtos.length) return produtos;

    const idsProdutos = produtos.map(produto => produto.id);

    const { data: imagens, error } = await supabase
        .from('produtosImagens')
        .select('idImagem, idProduto, caminho_arquivo, nome_variacao')
        .in('idProduto', idsProdutos)
        .order('idImagem', { ascending: true });

    if (error) {
        throw new Error(
            `Não foi possível carregar as imagens dos produtos: ${error.message}`
        );
    }

    const imagensPorProduto = new Map();

    for (const registro of imagens ?? []) {
        const idProduto = Number(registro.idProduto);
        const caminho = registro.caminho_arquivo;
        const nomeVariacao = String(
            registro.nome_variacao ?? ''
        ).trim();

        if (!caminho) continue;

        if (!imagensPorProduto.has(idProduto)) {
            imagensPorProduto.set(idProduto, []);
        }

        imagensPorProduto.get(idProduto).push({
            imagem: caminho,
            variacao: nomeVariacao || 'Padrão'
        });
    }

    return produtos.map(produto => {
        const variantes =
            imagensPorProduto.get(Number(produto.id)) ?? [];

        if (!variantes.length) {
            return {
                ...produto,
                imagens: [IMAGEM_PADRAO],
                variacoes: ['Padrão'],
                variantes: [{
                    variacao: 'Padrão',
                    imagem: IMAGEM_PADRAO
                }]
            };
        }

        return {
            ...produto,

            // Array de URLs, para manter compatibilidade com o catálogo.
            imagens: variantes.map(item => item.imagem),

            // Array de nomes, alinhado com o array de imagens.
            variacoes: variantes.map(item => item.variacao),

            // Estrutura completa usada na página de detalhes e no carrinho.
            variantes
        };
    });
}

export async function listarProdutos(filtros = {}) {
    let consulta = supabase
        .from('produtos')
        .select(`
            id_produto,
            fk_vendedor,
            fk_categoria,
            nome_produto,
            descricao,
            preco_unitario,
            estoque_minimo,
            estoque_atual,
            ativo,
            tipo_compra,
            categorias (
                id_categoria,
                nome_categoria
            ),
            empresas!produtos_fk_vendedor_fkey (
                id_empresa,
                nome_fantasia
            )
        `)
        .eq('ativo', true)
        .order('nome_produto');

    if (filtros.busca) {
        consulta = consulta.ilike(
            'nome_produto',
            `%${filtros.busca}%`
        );
    }

    if (filtros.categoria) {
        consulta = consulta.eq(
            'fk_categoria',
            Number(filtros.categoria)
        );
    }

    const faixa = faixasPreco[filtros.preco];

    if (faixa) {
        if (filtros.preco === 'ate-100') {
            consulta = consulta
                .gt('preco_unitario', 0)
                .lte('preco_unitario', 100);
        } else {
            consulta = consulta
                .gt('preco_unitario', faixa[0])
                .lte('preco_unitario', faixa[1]);
        }
    }

    const { data, error } = await consulta;

    if (error) throw error;

    let produtos = (data ?? []).map(adaptarProduto);

    // Filtro de empresa por nome parcial, ignorando acentos,
    // espaços, pontuação e diferenças entre maiúsculas/minúsculas.
    if (filtros.empresa) {
        const termoEmpresa = normalizarTexto(filtros.empresa);

        if (termoEmpresa) {
            produtos = produtos.filter(produto =>
                normalizarTexto(produto.empresa?.nome)
                    .includes(termoEmpresa)
            );
        }
    }

    return associarImagens(produtos);
}

export async function buscarProduto(id) {
    const identificador = Number(id);

    if (
        !Number.isSafeInteger(identificador) ||
        identificador <= 0
    ) {
        return null;
    }

    const { data, error } = await supabase
        .from('produtos')
        .select(`
            id_produto,
            fk_vendedor,
            fk_categoria,
            nome_produto,
            descricao,
            preco_unitario,
            estoque_minimo,
            estoque_atual,
            ativo,
            tipo_compra,
            categorias (
                id_categoria,
                nome_categoria
            ),
            empresas!produtos_fk_vendedor_fkey (
                id_empresa,
                nome_fantasia
            )
        `)
        .eq('id_produto', identificador)
        .eq('ativo', true)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [produto] = await associarImagens([
        adaptarProduto(data)
    ]);

    return produto;
}
