
import { obterClienteAutenticado } from './pagamento.js';

// Lista todos os pedidos pertencentes ao usuário.
export async function listarPedidos(usuarioId, req) {

    const cliente = await obterClienteAutenticado(req);

    const { data: pedidos, error } = await cliente
        .from('pedidos')
        .select('*')
        .eq('fk_comprador', usuarioId)
        .order('data_emissao', { ascending: false });

    if (error) {
        throw new Error(
            `Erro ao consultar pedidos: ${error.message}`
        );
    }

    if (!pedidos || pedidos.length === 0) {
        return [];
    }

    // Busca os endereços associados aos pedidos.
    const enderecoIds = [
        ...new Set(pedidos.map(pedido => pedido.fk_endereco))
    ];

    const { data: enderecos, error: erroEnderecos } = await cliente
        .from('enderecos')
        .select('*')
        .in('id_endereco', enderecoIds)
        .eq('idUsuario', usuarioId);

    if (erroEnderecos) {
        throw new Error(
            `Erro ao consultar endereços dos pedidos: ${erroEnderecos.message}`
        );
    }

    const mapaEnderecos = new Map();

    for (const endereco of enderecos || []) {
        mapaEnderecos.set(endereco.id_endereco, endereco);
    }

    return pedidos.map(pedido => ({
        ...pedido,
        endereco: mapaEnderecos.get(pedido.fk_endereco) || null
    }));
}


// Busca os detalhes de um pedido específico.
// A consulta sempre verifica o comprador.
export async function buscarDetalhesPedido(
    pedidoId,
    usuarioId,
    req
) {

    const cliente = await obterClienteAutenticado(req);

    const { data: pedido, error } = await cliente
        .from('pedidos')
        .select('*')
        .eq('id_pedido', pedidoId)
        .eq('fk_comprador', usuarioId)
        .maybeSingle();

    if (error) {
        throw new Error(
            `Erro ao consultar pedido: ${error.message}`
        );
    }

    // Não permite acessar pedidos de outros usuários.
    if (!pedido) {
        return null;
    }

    // Busca itens, endereço e pagamento.
    const [
        resultadoItens,
        resultadoEndereco,
        resultadoPagamento
    ] = await Promise.all([

        cliente
            .from('itens_pedido')
            .select('*')
            .eq('fk_pedido', pedidoId),

        cliente
            .from('enderecos')
            .select('*')
            .eq('id_endereco', pedido.fk_endereco)
            .eq('idUsuario', usuarioId)
            .maybeSingle(),

        cliente
            .from('pagamentos')
            .select('*')
            .eq('fk_pedido', pedidoId)
            .maybeSingle()

    ]);

    if (resultadoItens.error) {
        throw new Error(
            `Erro ao consultar itens do pedido: ${resultadoItens.error.message}`
        );
    }

    if (resultadoEndereco.error) {
        throw new Error(
            `Erro ao consultar endereço: ${resultadoEndereco.error.message}`
        );
    }

    if (resultadoPagamento.error) {
        throw new Error(
            `Erro ao consultar pagamento: ${resultadoPagamento.error.message}`
        );
    }

    const itensOriginais = resultadoItens.data || [];

    // Busca os nomes dos produtos associados aos itens.
    const produtoIds = [
        ...new Set(itensOriginais.map(item => item.fk_produto))
    ];

    let produtos = [];

    if (produtoIds.length > 0) {

        const { data, error } = await cliente
            .from('produtos')
            .select('id_produto, nome_produto, tipo_compra')
            .in('id_produto', produtoIds);

        if (error) {
            throw new Error(
                `Erro ao consultar produtos do pedido: ${error.message}`
            );
        }

        produtos = data || [];
    }

    const mapaProdutos = new Map();

    for (const produto of produtos) {
        mapaProdutos.set(produto.id_produto, produto);
    }

    const itens = itensOriginais.map(item => ({
        ...item,
        produto: mapaProdutos.get(item.fk_produto) || null
    }));

    return {
        pedido,
        itens,
        endereco: resultadoEndereco.data || null,
        pagamento: resultadoPagamento.data || null
    };
}
