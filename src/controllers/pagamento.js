import { 
    listarItensCarrinho, 
    limparCarrinhoUsuario 
} from '../models/carrinho.js';

import { renderizarPagina } from '../utils/apresentacao.js';

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

// GET /pagamento
export async function exibirPagamento(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        const carrinho = await listarItensCarrinho(usuario.id, req);

        const quantidade = Number(carrinho?.quantidade) || 0;
        const valorNumerico = Number(carrinho?.total) || 0;
        const total = Number(Math.max(0, valorNumerico).toFixed(2));

        return renderizarPagina(
            res,
            'pagamento',
            'Finalizar Pagamento | Empr-E',
            {
                itens: carrinho?.itens || [],
                quantidade,
                quantidadeTotal: quantidade,
                total,
                totalGeral: total,
                usuarioLogado: usuario
            }
        );
    } catch (erro) {
        console.error('Erro ao carregar checkout:', erro);

        return renderizarPagina(
            res.status(500),
            'indisponivel',
            'Pagamento | Empr-E',
            {
                tituloPagina: 'Não foi possível carregar o checkout',
                mensagem: erro.message || 'Ocorreu um erro ao carregar os dados do seu pedido.'
            }
        );
    }
}

export async function processarPagamento(req, res) {
    const usuario = obterUsuarioAutenticado(req, res);
    if (!usuario) return;

    try {
        await limparCarrinhoUsuario(usuario.id, req);
        return res.redirect('/conta/pedidos');
    } catch (erro) {
        console.error('Erro ao processar pagamento:', erro);

        return renderizarPagina(
            res.status(500),
            'indisponivel',
            'Pagamento | Empr-E',
            {
                tituloPagina: 'Erro ao finalizar pedido',
                mensagem: 'Não foi possível registrar o pedido. Tente novamente.'
            }
        );
    }
}