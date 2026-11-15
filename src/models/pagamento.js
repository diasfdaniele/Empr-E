
import { createClient } from '@supabase/supabase-js';

export const metodosPagamento = Object.freeze([
    'pix',
    'cartao',
    'boleto'
]);

// Cria um cliente sem sessão para renovar o token.
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

// Obtém o cliente autenticado utilizando a sessão.
export async function obterClienteAutenticado(req) {

    let tokens = req.session?.tokens;

    if (!tokens?.accessToken) {
        throw new Error(
            'Sua sessão expirou. Entre novamente.'
        );
    }

    const expiraEm = Number(tokens.expiresAt ?? 0) * 1000;

    // Renova o token quando estiver próximo do vencimento.
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
                'Sua sessão expirou. Entre novamente.'
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

// Lista os endereços disponíveis para o checkout.
export async function listarEnderecosPagamento(
    usuarioId,
    req
) {

    const cliente = await obterClienteAutenticado(req);

    const { data, error } = await cliente
        .from('enderecos')
        .select('*')
        .eq('idUsuario', usuarioId)
        .order('id_endereco', { ascending: true });

    if (error) {
        throw new Error(
            `Erro ao consultar endereços: ${error.message}`
        );
    }

    return data || [];
}

// Finaliza o pedido e registra o pagamento.
export async function finalizarPedido(dados, req) {

    const cliente = await obterClienteAutenticado(req);

    const enderecoId = Number(dados.enderecoId);
    const parcelas = Number(dados.parcelas || 1);

    if (
        !Number.isSafeInteger(enderecoId) ||
        enderecoId < 1
    ) {
        throw new Error('Selecione um endereço válido.');
    }

    if (!metodosPagamento.includes(dados.metodo)) {
        throw new Error('Selecione um método de pagamento válido.');
    }

    if (
        !Number.isSafeInteger(parcelas) ||
        parcelas < 1 ||
        parcelas > 12
    ) {
        throw new Error('Parcelamento inválido.');
    }

    if (
        dados.metodo !== 'cartao' &&
        parcelas !== 1
    ) {
        throw new Error(
            'Este método de pagamento não permite parcelamento.'
        );
    }

    const { data, error } = await cliente.rpc(
        'finalizar_pedido',
        {
            p_endereco_id: enderecoId,
            p_metodo: dados.metodo,
            p_parcelas: parcelas,
            p_observacoes: String(
                dados.observacoes || ''
            ).trim() || null
        }
    );

    if (error) {
        console.error(
            'Erro ao finalizar pedido no Supabase:',
            error
        );

        throw new Error(
            error.message || 'Não foi possível finalizar o pedido.'
        );
    }

    return Number(data);
}
