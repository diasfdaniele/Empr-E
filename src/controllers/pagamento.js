
import {
    listarItensCarrinho
} from '../models/carrinho.js';

import {
    listarEnderecosPagamento,
    finalizarPedido
} from '../models/pagamento.js';

import {
    cadastrarEndereco
} from '../models/usuario.js';

import {
    renderizarPagina
} from '../utils/apresentacao.js';

export function obterUsuarioAutenticado(req, res) {

    if (
        !req.session?.usuario ||
        !req.session?.tokens?.accessToken
    ) {
        res.redirect('/login');
        return null;
    }

    return req.session.usuario;
}

// GET /pagamento
export async function exibirPagamento(req, res) {

    const usuario = obterUsuarioAutenticado(req, res);

    if (!usuario) return;

    try {

        const [
            carrinho,
            enderecos
        ] = await Promise.all([

            listarItensCarrinho(usuario.id, req),

            listarEnderecosPagamento(usuario.id, req)

        ]);

        if (!carrinho?.itens?.length || carrinho.total <= 0) {
            return res.redirect('/carrinho');
        }

        const formatarMoeda = (valor) => {

            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(Number(valor) || 0);

        };

        return renderizarPagina(
            res,
            'pagamento',
            'Finalizar Pagamento | Empr-E',
            {
                itens: carrinho.itens,

                quantidade: carrinho.quantidade,

                quantidadeTotal: carrinho.quantidade,

                total: carrinho.total,

                totalGeral: carrinho.total,

                enderecos,

                usuarioLogado: usuario,

                formatarMoeda,

                erro: req.query.erro || null,

                sucesso: req.query.sucesso || null
            }
        );

    } catch (erro) {

        console.error(
            'Erro ao carregar checkout:',
            erro
        );

        return renderizarPagina(
            res.status(500),
            'indisponivel',
            'Pagamento | Empr-E',
            {
                tituloPagina: 'Não foi possível carregar o checkout',
                mensagem: erro.message
            }
        );
    }
}

// POST /pagamento/enderecos
export async function cadastrarEnderecoCheckout(req, res) {

    const usuario = obterUsuarioAutenticado(req, res);

    if (!usuario) return;

    try {

        await cadastrarEndereco(
            usuario.id,
            req,
            req.body
        );

        return res.redirect(
            '/pagamento?sucesso=endereco'
        );

    } catch (erro) {

        console.error(
            'Erro ao cadastrar endereço no checkout:',
            erro
        );

        return res.redirect(
            '/pagamento?erro=endereco'
        );
    }
}

// POST /pagamento/confirmar
export async function processarPagamento(req, res) {

    const usuario = obterUsuarioAutenticado(req, res);

    if (!usuario) return;

    try {

        const pedidoId = await finalizarPedido(
            {
                enderecoId: req.body.enderecoId,
                metodo: req.body.metodo,
                parcelas: req.body.parcelas,
                observacoes: req.body.observacoes
            },
            req
        );

        console.log(
            `Pedido ${pedidoId} finalizado pelo usuário ${usuario.id}.`
        );

        return res.redirect(
            '/conta/pedidos?sucesso=pedido'
        );

    } catch (erro) {

         console.error('Mensagem:', erro.message);
            console.error('Detalhes:', erro.details);
            console.error('Código:', erro.code);
            console.error('Dica:', erro.hint);

        return res.redirect(
            '/pagamento?erro=finalizacao'
        );
    }
}
