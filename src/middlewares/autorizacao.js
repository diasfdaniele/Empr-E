
import { obterClienteAutenticado } from '../models/pagamento.js';

import {
    exibirIndisponibilidade
} from '../utils/apresentacao.js';

export async function autorizarAdministrador(req, res, next) {
    if (
        !req.session?.usuario ||
        !req.session?.tokens?.accessToken
    ) {
        return res.redirect('/login');
    }

    try {
        const cliente = await obterClienteAutenticado(req);

        // Confirma a identidade do usuário pelo token.
        const {
            data: { user },
            error: erroAuth
        } = await cliente.auth.getUser();

        if (erroAuth || !user) {
            return res.redirect('/login');
        }

        // Consulta o papel diretamente no banco.
        const { data: usuario, error } = await cliente
            .from('usuarios')
            .select('id_usuario, id_auth, papel')
            .eq('id_auth', user.id)
            .maybeSingle();

        if (error || !usuario) {
            return exibirIndisponibilidade(
                req,
                res,
                403,
                'Acesso negado',
                'Não foi possível validar as permissões da sua conta.'
            );
        }

        if (usuario.papel !== 'administrador') {
            return exibirIndisponibilidade(
                req,
                res,
                403,
                'Acesso restrito',
                'Você não possui autorização para acessar o painel administrativo.'
            );
        }

        req.session.usuario.papel = usuario.papel;

        return next();

    } catch (erro) {
        console.error(
            'Erro ao validar administrador:',
            erro
        );

        return exibirIndisponibilidade(
            req,
            res,
            500,
            'Falha na autorização',
            'Não foi possível verificar suas permissões.'
        );
    }
}
