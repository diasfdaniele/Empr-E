import {
    listarTodosUsuarios,
    listarTodasEmpresas,
    listarTodosProdutos,
    listarTodosPedidos,

    atualizarUsuarioAdmin as atualizarUsuarioAdminModel,
    excluirUsuarioAdmin as excluirUsuarioAdminModel,

    atualizarEmpresaAdmin as atualizarEmpresaAdminModel,
    excluirEmpresaAdmin as excluirEmpresaAdminModel,

    atualizarProdutoAdmin as atualizarProdutoAdminModel,
    excluirProdutoAdmin as excluirProdutoAdminModel,

    atualizarPedidoAdmin as atualizarPedidoAdminModel,
    excluirPedidoAdmin as excluirPedidoAdminModel
} from '../models/administrador.js';



import {
    renderizarPagina,
    exibirIndisponibilidade
} from '../utils/apresentacao.js';

export async function exibirAdministracao(req, res) {
    try {
        const [
            usuarios,
            empresas,
            produtos,
            pedidos
        ] = await Promise.all([
            listarTodosUsuarios(req),
            listarTodasEmpresas(req),
            listarTodosProdutos(req),
            listarTodosPedidos(req)
        ]);

        // Contas compradoras.
        const compradores = usuarios.filter(
            usuario => usuario.papel === 'comprador'
        );

        // Empresas vinculadas a usuários cadastrados.
        const empresasVinculadas = empresas.filter(
            empresa => empresa.id_usuario !== null &&
                       empresa.id_usuario !== undefined
        );

        // Empresas sem usuário vinculado: registros históricos.
        const empresasHistoricas = empresas.filter(
            empresa => empresa.id_usuario === null ||
                       empresa.id_usuario === undefined
        );

        // Empresas ativas pertencentes a vendedores cadastrados.
        const vendedoras = empresasVinculadas.filter(
            empresa => empresa.status_conta === 'Ativo'
        );

        // Formatação de datas.
        const formatarData = data => {
            if (!data) return '-';

            return new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            }).format(new Date(data));
        };

        // Formatação monetária.
        const formatarMoeda = valor => {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(Number(valor) || 0);
        };
        
        const mensagemAdmin = req.session.mensagemAdmin || null;
        delete req.session.mensagemAdmin;

        return renderizarPagina(
            res,
            'restritas/administracao',
            'Painel administrativo | Empr-E',
            {
                usuarioLogado: req.session.usuario,
                mensagemAdmin,
                usuarios,
                compradores,

                empresas: empresasVinculadas,
                empresasHistoricas,
                vendedoras,

                produtos,
                pedidos,

                metricas: {
                    totalUsuarios: usuarios.length,
                    totalCompradores: compradores.length,
                    totalVendedoras: vendedoras.length,
                    totalEmpresas: empresasVinculadas.length,
                    totalEmpresasHistoricas: empresasHistoricas.length,
                    totalProdutos: produtos.length,
                    totalPedidos: pedidos.length
                },

                formatarData,
                formatarMoeda
            }
        );

    } catch (erro) {
        console.error(
            'Erro ao carregar painel administrativo:',
            erro
        );

        return exibirIndisponibilidade(
            req,
            res,
            500,
            'Painel administrativo indisponível',
            'Não foi possível consultar os dados administrativos. Verifique as permissões do banco de dados e tente novamente.'
        );
    }
}


// ======================================================
// AÇÕES ADMINISTRATIVAS
// ======================================================

async function executarAcaoAdmin(
    req,
    res,
    operacao,
    mensagemSucesso
) {
    try {
        await operacao(req, req.params.id);

        req.session.mensagemAdmin = {
            tipo: 'sucesso',
            texto: mensagemSucesso
        };

    } catch (erro) {
        console.error(
            'Erro em operação administrativa:',
            erro
        );

        req.session.mensagemAdmin = {
            tipo: 'erro',
            texto: erro.message ||
                'Não foi possível concluir a operação.'
        };
    }

    return res.redirect('/conta/admin');
}


// ------------------------------------------------------
// USUÁRIOS
// ------------------------------------------------------

export async function atualizarUsuarioAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        atualizarUsuarioAdminModel,
        'Usuário atualizado com sucesso.'
    );
}

export async function excluirUsuarioAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        excluirUsuarioAdminModel,
        'Usuário excluído com sucesso.'
    );
}


// ------------------------------------------------------
// EMPRESAS
// ------------------------------------------------------

export async function atualizarEmpresaAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        atualizarEmpresaAdminModel,
        'Empresa atualizada com sucesso.'
    );
}

export async function excluirEmpresaAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        excluirEmpresaAdminModel,
        'Empresa excluída com sucesso.'
    );
}


// ------------------------------------------------------
// PRODUTOS
// ------------------------------------------------------

export async function atualizarProdutoAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        atualizarProdutoAdminModel,
        'Produto atualizado com sucesso.'
    );
}

export async function excluirProdutoAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        excluirProdutoAdminModel,
        'Produto excluído com sucesso.'
    );
}


// ------------------------------------------------------
// PEDIDOS
// ------------------------------------------------------

export async function atualizarPedidoAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        atualizarPedidoAdminModel,
        'Pedido atualizado com sucesso.'
    );
}

export async function excluirPedidoAdmin(req, res) {
    return executarAcaoAdmin(
        req,
        res,
        excluirPedidoAdminModel,
        'Pedido excluído com sucesso.'
    );
}
