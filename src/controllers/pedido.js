
import {
    listarPedidos,
    buscarDetalhesPedido
} from '../models/pedido.js';

import {
    renderizarPagina
} from '../utils/apresentacao.js';


function obterUsuarioAutenticado(req, res) {

    if (
        !req.session?.usuario ||
        !req.session?.tokens?.accessToken
    ) {
        res.redirect('/login');
        return null;
    }

    return req.session.usuario;
}


function formatarMoeda(valor) {

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(valor) || 0);

}


function formatarData(data) {

    if (!data) {
        return 'Data não informada';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short'
    }).format(new Date(data));

}


// GET /conta/pedidos
export async function exibirPedidos(req, res) {

    const usuario = obterUsuarioAutenticado(req, res);

    if (!usuario) return;

    try {

        const pedidos = await listarPedidos(
            usuario.id,
            req
        );

        return renderizarPagina(
            res,
            'restritas/pedidos',
            'Meus Pedidos | Empr-E',
            {
                usuarioLogado: usuario,
                pedidos,
                formatarMoeda,
                formatarData
            }
        );

    } catch (erro) {

        console.error(
            'Erro ao carregar pedidos:',
            erro
        );

        return renderizarPagina(
            res.status(500),
            'indisponivel',
            'Pedidos | Empr-E',
            {
                tituloPagina: 'Não foi possível carregar seus pedidos',
                mensagem: erro.message
            }
        );
    }
}


// GET /conta/pedidos/:id
export async function exibirDetalhesPedido(req, res) {

    const usuario = obterUsuarioAutenticado(req, res);

    if (!usuario) return;

    const pedidoId = Number(req.params.id);

    if (
        !Number.isSafeInteger(pedidoId) ||
        pedidoId < 1
    ) {
        return renderizarPagina(
            res.status(404),
            'indisponivel',
            'Pedido não encontrado | Empr-E',
            {
                tituloPagina: 'Pedido não encontrado',
                mensagem: 'O pedido informado não existe ou não está disponível para sua conta.'
            }
        );
    }

    try {

        const detalhes = await buscarDetalhesPedido(
            pedidoId,
            usuario.id,
            req
        );

        if (!detalhes) {

            return renderizarPagina(
                res.status(404),
                'indisponivel',
                'Pedido não encontrado | Empr-E',
                {
                    tituloPagina: 'Pedido não encontrado',
                    mensagem: 'O pedido informado não existe ou não está disponível para sua conta.'
                }
            );

        }

        return renderizarPagina(
            res,
            'restritas/pedido-detalhes',
            `Pedido #${pedidoId} | Empr-E`,
            {
                usuarioLogado: usuario,
                pedido: detalhes.pedido,
                itens: detalhes.itens,
                endereco: detalhes.endereco,
                pagamento: detalhes.pagamento,
                formatarMoeda,
                formatarData
            }
        );

    } catch (erro) {

        console.error(
            'Erro ao carregar detalhes do pedido:',
            erro
        );

        return renderizarPagina(
            res.status(500),
            'indisponivel',
            'Pedido | Empr-E',
            {
                tituloPagina: 'Não foi possível carregar o pedido',
                mensagem: erro.message
            }
        );
    }
}
