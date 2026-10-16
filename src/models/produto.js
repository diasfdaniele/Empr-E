import {supabase} from '../../config/db.js';

function adaptarProduto(registro) {
    if (!registro) {
        return null;
    }

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
            if (this.modalidade === 'compra') {
                return 'Compra imediata';
            }

            if (this.modalidade === 'projeto') {
                return 'Projeto personalizado';
            }

            return this.modalidade || 'Não informada';
        },

        // Temporário: a tabela ainda não armazena esses dados.
        imagens: ['/imagens/produto-padrao.png'],
        variacoes: ['Padrão']
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

    if (error) {
        throw error;
    }

    return data;
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

    if (error) {
        throw error;
    }

    return data.map(adaptarProduto);
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

    if (error) {
        throw error;
    }

    return adaptarProduto(data);
}