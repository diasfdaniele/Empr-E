
import { createClient } from '@supabase/supabase-js';
import { buscarProduto } from './produto.js';

const MAX_QUANTIDADE = 999;

function criarClienteBase() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
}

async function obterClienteAutenticado(req) {
    let tokens = req.session?.tokens;

    if (!tokens?.accessToken) {
        throw new Error(
            'Sua sessão expirou. Entre novamente para acessar o carrinho.'
        );
    }

    const expiraEm = Number(tokens.expiresAt ?? 0) * 1000;

    if (
        tokens.refreshToken &&
        (!expiraEm || expiraEm <= Date.now() + 30000)
    ) {
        const clienteBase = criarClienteBase();

        const { data, error } =
            await clienteBase.auth.refreshSession({
                refresh_token: tokens.refreshToken
            });

        if (error || !data.session) {
            throw new Error(
                'Sua sessão expirou. Entre novamente para acessar o carrinho.'
            );
        }

        tokens = {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
        };

        req.session.tokens = tokens;
    }

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${tokens.accessToken}`
                }
            }
        }
    );
}

function validarId(valor, campo) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id < 1) {
        throw new TypeError(`${campo} inválido.`);
    }

    return id;
}

function validarQuantidade(valor) {
    const quantidade = Number(valor);

    if (
        !Number.isSafeInteger(quantidade) ||
        quantidade < 1 ||
        quantidade > MAX_QUANTIDADE
    ) {
        throw new TypeError(
            `A quantidade deve estar entre 1 e ${MAX_QUANTIDADE}.`
        );
    }

    return quantidade;
}

function ehCompraImediata(produto) {
    const modalidade = String(
        produto?.modalidade ?? ''
    ).trim().toLowerCase();

    return modalidade === 'compra' ||
        modalidade === 'compra imediata';
}

function normalizarVariacao(produto, valor) {
    const solicitada = String(valor ?? '').trim();

    const variante = produto.variantes?.find(
        item => item.variacao === solicitada
    );

    if (variante) return variante.variacao;

    // Compatibilidade com produtos sem imagens cadastradas.
    if (
        solicitada === 'Padrão' &&
        produto.variantes?.length === 1 &&
        produto.variantes[0].variacao === 'Padrão'
    ) {
        return 'Padrão';
    }

    throw new Error(
        'A variação selecionada não está disponível para esse produto.'
    );
}

async function buscarOuCriarCarrinho(cliente, usuarioId) {
    const id = validarId(usuarioId, 'Usuário');

    const { data: existente, error: erroBusca } = await cliente
        .from('carrinhos')
        .select('id_carrinho, subtotal, idUsuario')
        .eq('idUsuario', id)
        .maybeSingle();

    if (erroBusca) {
        throw new Error(
            `Não foi possível consultar o carrinho: ${erroBusca.message}`
        );
    }

    if (existente) return existente;

    const { data: criado, error: erroCriacao } = await cliente
        .from('carrinhos')
        .insert({
            idUsuario: id,
            subtotal: 0
        })
        .select('id_carrinho, subtotal, idUsuario')
        .single();

    if (erroCriacao) {
        throw new Error(
            `Não foi possível criar o carrinho: ${erroCriacao.message}`
        );
    }

    return criado;
}

async function calcularESalvarSubtotal(cliente, carrinhoId) {
    const { data: linhas, error } = await cliente
        .from('produtos_carrinho')
        .select('fk_produto, quantidade')
        .eq('fk_carrinho', carrinhoId);

    if (error) {
        throw new Error(
            `Não foi possível calcular o carrinho: ${error.message}`
        );
    }

    let subtotalCentavos = 0;

    for (const linha of linhas ?? []) {
        const produto = await buscarProduto(linha.fk_produto);

        if (produto && ehCompraImediata(produto)) {
            subtotalCentavos +=
                Math.round(Number(produto.preco) * 100) *
                linha.quantidade;
        }
    }

    const subtotal = subtotalCentavos / 100;

    const { error: erroAtualizacao } = await cliente
        .from('carrinhos')
        .update({ subtotal })
        .eq('id_carrinho', carrinhoId);

    if (erroAtualizacao) {
        throw new Error(
            `Não foi possível salvar o subtotal: ${erroAtualizacao.message}`
        );
    }

    return subtotal;
}

export async function listarItensCarrinho(usuarioId, req) {
    const cliente = await obterClienteAutenticado(req);
    const carrinho = await buscarOuCriarCarrinho(
        cliente,
        usuarioId
    );

    const { data: linhas, error } = await cliente
        .from('produtos_carrinho')
        .select('fk_produto, quantidade, variacao, criado_em')
        .eq('fk_carrinho', carrinho.id_carrinho)
        .order('criado_em', { ascending: true });

    if (error) {
        throw new Error(
            `Não foi possível carregar os itens: ${error.message}`
        );
    }

    const itens = [];

    for (const linha of linhas ?? []) {
        const produto = await buscarProduto(linha.fk_produto);

        if (!produto) continue;

        const variacao = normalizarVariacao(
            produto,
            linha.variacao
        );

        const variante = produto.variantes.find(
            item => item.variacao === variacao
        );

        itens.push({
            produto,
            quantidade: linha.quantidade,
            variacao,
            imagem: variante?.imagem ?? produto.imagens[0]
        });
    }

    const totalCentavos = itens.reduce((soma, item) => {
        if (!ehCompraImediata(item.produto)) return soma;

        return soma +
            Math.round(Number(item.produto.preco) * 100) *
            item.quantidade;
    }, 0);

    const quantidade = itens.reduce(
        (soma, item) => soma + item.quantidade,
        0
    );

    return {
        carrinhoId: carrinho.id_carrinho,
        itens,
        quantidade,
        total: totalCentavos / 100
    };
}

export async function adicionarItemCarrinho(
    usuarioId,
    req,
    produtoId,
    quantidadeInformada = 1,
    variacaoInformada
) {
    const cliente = await obterClienteAutenticado(req);
    const idProduto = validarId(produtoId, 'Produto');
    const quantidadeAdicionar = validarQuantidade(
        quantidadeInformada
    );

    const produto = await buscarProduto(idProduto);

    if (!produto) {
        throw new Error(
            'Esse produto não está disponível no catálogo.'
        );
    }

    const variacao = normalizarVariacao(
        produto,
        variacaoInformada ?? produto.variantes[0]?.variacao
    );

    const carrinho = await buscarOuCriarCarrinho(
        cliente,
        usuarioId
    );

    const { data: existente, error: erroBusca } = await cliente
        .from('produtos_carrinho')
        .select('quantidade')
        .eq('fk_carrinho', carrinho.id_carrinho)
        .eq('fk_produto', idProduto)
        .eq('variacao', variacao)
        .maybeSingle();

    if (erroBusca) {
        throw new Error(
            `Não foi possível consultar o item: ${erroBusca.message}`
        );
    }

    const novaQuantidade = validarQuantidade(
        (existente?.quantidade ?? 0) + quantidadeAdicionar
    );

    const { error } = await cliente
        .from('produtos_carrinho')
        .upsert(
            {
                fk_carrinho: carrinho.id_carrinho,
                fk_produto: idProduto,
                quantidade: novaQuantidade,
                variacao
            },
            {
                onConflict: 'fk_carrinho,fk_produto,variacao'
            }
        );

    if (error) {
        throw new Error(
            `Não foi possível adicionar o produto: ${error.message}`
        );
    }

    await calcularESalvarSubtotal(
        cliente,
        carrinho.id_carrinho
    );
}

export async function definirQuantidadeItemCarrinho(
    usuarioId,
    req,
    produtoId,
    quantidadeInformada,
    variacaoInformada
) {
    const cliente = await obterClienteAutenticado(req);
    const idProduto = validarId(produtoId, 'Produto');
    const quantidade = validarQuantidade(quantidadeInformada);
    const produto = await buscarProduto(idProduto);

    if (!produto) {
        throw new Error('Produto não encontrado.');
    }

    const variacao = normalizarVariacao(
        produto,
        variacaoInformada
    );

    const carrinho = await buscarOuCriarCarrinho(
        cliente,
        usuarioId
    );

    const { data: item, error: erroBusca } = await cliente
        .from('produtos_carrinho')
        .select('fk_produto')
        .eq('fk_carrinho', carrinho.id_carrinho)
        .eq('fk_produto', idProduto)
        .eq('variacao', variacao)
        .maybeSingle();

    if (erroBusca) {
        throw new Error(
            `Não foi possível consultar o item: ${erroBusca.message}`
        );
    }

    if (!item) {
        throw new Error('Esse item não está no seu carrinho.');
    }

    const { error } = await cliente
        .from('produtos_carrinho')
        .update({ quantidade })
        .eq('fk_carrinho', carrinho.id_carrinho)
        .eq('fk_produto', idProduto)
        .eq('variacao', variacao);

    if (error) {
        throw new Error(
            `Não foi possível atualizar a quantidade: ${error.message}`
        );
    }

    await calcularESalvarSubtotal(
        cliente,
        carrinho.id_carrinho
    );
}

export async function removerItemCarrinho(
    usuarioId,
    req,
    produtoId,
    variacaoInformada
) {
    const cliente = await obterClienteAutenticado(req);
    const idProduto = validarId(produtoId, 'Produto');
    const produto = await buscarProduto(idProduto);

    if (!produto) {
        throw new Error('Produto não encontrado.');
    }

    const variacao = normalizarVariacao(
        produto,
        variacaoInformada
    );

    const carrinho = await buscarOuCriarCarrinho(
        cliente,
        usuarioId
    );

    const { error } = await cliente
        .from('produtos_carrinho')
        .delete()
        .eq('fk_carrinho', carrinho.id_carrinho)
        .eq('fk_produto', idProduto)
        .eq('variacao', variacao);

    if (error) {
        throw new Error(
            `Não foi possível remover o produto: ${error.message}`
        );
    }

    await calcularESalvarSubtotal(
        cliente,
        carrinho.id_carrinho
    );
}

export async function limparCarrinhoUsuario(usuarioId, req) {
    const cliente = await obterClienteAutenticado(req);
    const carrinho = await buscarOuCriarCarrinho(
        cliente,
        usuarioId
    );

    const { error } = await cliente
        .from('produtos_carrinho')
        .delete()
        .eq('fk_carrinho', carrinho.id_carrinho);

    if (error) {
        throw new Error(
            `Não foi possível limpar o carrinho: ${error.message}`
        );
    }

    await calcularESalvarSubtotal(
        cliente,
        carrinho.id_carrinho
    );
}
