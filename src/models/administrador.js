import { obterClienteAutenticado } from './pagamento.js';
import { supabaseAdmin } from '../../config/dbAdmin.js';

// Lista todos os usuários cadastrados.
export async function listarTodosUsuarios(req) {
    const cliente = await obterClienteAutenticado(req);

    const { data, error } = await cliente
        .from('usuarios')
        .select(`
            id_usuario,
            id_auth,
            tipo_pessoa,
            login,
            nome_completo,
            cpf_pessoa,
            papel,
            criado_em
        `)
        .order('id_usuario', { ascending: false });

    if (error) {
        throw new Error(
            `Erro ao consultar usuários: ${error.message}`
        );
    }

    return data || [];
}


// Lista todas as empresas cadastradas.
export async function listarTodasEmpresas(req) {
    const cliente = await obterClienteAutenticado(req);

    const { data: empresas, error } = await cliente
        .from('empresas')
        .select(`
            id_empresa,
            id_usuario,
            cnpj,
            razao_social,
            nome_fantasia,
            status_conta,
            categoria_empresa,
            logo_url,
            inscricao_estadual,
            tipo_empresa,
            descricao,
            site
        `)
        .order('id_empresa', { ascending: false });

    if (error) {
        throw new Error(
            `Erro ao consultar empresas: ${error.message}`
        );
    }

    if (!empresas?.length) {
        return [];
    }

    // Remove IDs nulos ou inválidos antes da consulta.
    const idsUsuarios = [
        ...new Set(
            empresas
                .map(empresa => empresa.id_usuario)
                .filter(id => {
                    if (id === null || id === undefined) {
                        return false;
                    }

                    const valor = String(id).trim().toLowerCase();

                    return (
                        valor !== '' &&
                        valor !== 'null' &&
                        valor !== 'undefined'
                    );
                })
                .map(String)
        )
    ];

    let usuarios = [];

    // Só consulta usuários se existirem empresas vinculadas.
    if (idsUsuarios.length > 0) {

        const { data, error: erroUsuarios } = await cliente
            .from('usuarios')
            .select(`
                id_usuario,
                nome_completo,
                login
            `)
            .in('id_usuario', idsUsuarios);

        if (erroUsuarios) {
            throw new Error(
                `Erro ao consultar responsáveis pelas empresas: ${erroUsuarios.message}`
            );
        }

        usuarios = data || [];
    }

    const mapaUsuarios = new Map(
        usuarios.map(usuario => [
            String(usuario.id_usuario),
            usuario
        ])
    );

    // Empresas sem usuário também serão exibidas.
    return empresas.map(empresa => ({
        ...empresa,

        responsavel: empresa.id_usuario !== null &&
                     empresa.id_usuario !== undefined
            ? mapaUsuarios.get(String(empresa.id_usuario)) || null
            : null
    }));
}



// Lista todos os produtos cadastrados.
export async function listarTodosProdutos(req) {
    const cliente = await obterClienteAutenticado(req);

    const { data: produtos, error } = await cliente
        .from('produtos')
        .select(`
            id_produto,
            fk_vendedor,
            fk_categoria,
            nome_produto,
            preco_unitario,
            estoque_atual,
            ativo,
            tipo_compra,
            criado_em,
            descricao,
            estoque_minimo
        `)
        .order('id_produto', { ascending: false });

    if (error) {
        throw new Error(
            `Erro ao consultar produtos: ${error.message}`
        );
    }

    if (!produtos?.length) {
        return [];
    }

    // fk_vendedor identifica a empresa responsável pelo produto.
    const idsEmpresas = [
        ...new Set(produtos.map(produto => produto.fk_vendedor))
    ];

    const { data: empresas, error: erroEmpresas } = await cliente
        .from('empresas')
        .select(`
            id_empresa,
            nome_fantasia
        `)
        .in('id_empresa', idsEmpresas);

    if (erroEmpresas) {
        throw new Error(
            `Erro ao consultar empresas dos produtos: ${erroEmpresas.message}`
        );
    }

    const mapaEmpresas = new Map(
        (empresas || []).map(empresa => [
            empresa.id_empresa,
            empresa.nome_fantasia
        ])
    );

    return produtos.map(produto => ({
        ...produto,
        empresa_nome:
            mapaEmpresas.get(produto.fk_vendedor) || 'Empresa não encontrada'
    }));
}


// Lista todos os pedidos registrados.
export async function listarTodosPedidos(req) {
    const cliente = await obterClienteAutenticado(req);

    const { data: pedidos, error } = await cliente
        .from('pedidos')
        .select(`
            id_pedido,
            fk_comprador,
            data_emissao,
            status_pedido,
            metodo_pagamento,
            total_estimado,
            possui_itens_sob_consulta,
            parcelamento,
            observacoes
        `)
        .order('id_pedido', { ascending: false });

    if (error) {
        throw new Error(
            `Erro ao consultar pedidos: ${error.message}`
        );
    }

    if (!pedidos?.length) return [];

    // Filtra IDs de compradores inválidos antes da consulta.
    const idsCompradores = [
        ...new Set(
            pedidos
                .map(pedido => pedido.fk_comprador)
                .filter(id => {
                    if (id === null || id === undefined) {
                        return false;
                    }

                    const valor = String(id).trim().toLowerCase();

                    return (
                        valor !== '' &&
                        valor !== 'null' &&
                        valor !== 'undefined' &&
                        /^\d+$/.test(valor)
                    );
                })
                .map(String)
        )
    ];

    let compradores = [];

    if (idsCompradores.length > 0) {
        const { data, error: erroCompradores } = await cliente
            .from('usuarios')
            .select(`
                id_usuario,
                nome_completo,
                login
            `)
            .in('id_usuario', idsCompradores);

        if (erroCompradores) {
            throw new Error(
                `Erro ao consultar compradores dos pedidos: ${erroCompradores.message}`
            );
        }

        compradores = data || [];
    }

    const mapaCompradores = new Map(
        compradores.map(comprador => [
            String(comprador.id_usuario),
            comprador
        ])
    );

    return pedidos.map(pedido => ({
        ...pedido,
        comprador:
            pedido.fk_comprador !== null &&
            pedido.fk_comprador !== undefined
                ? mapaCompradores.get(
                    String(pedido.fk_comprador)
                ) || null
                : null
    }));
}


// ======================================================
// OPERAÇÕES ADMINISTRATIVAS
// ======================================================

const BUCKET_IMAGENS_PRODUTOS = 'ImagensProdutos';
const BUCKET_LOGOS_EMPRESAS = 'logosEmpresas';

const STATUS_EMPRESA_VALIDOS = [
    'Ativo',
    'Bloqueado',
    'Aguardando Aprovação'
];

const PAPEIS_VALIDOS = [
    'comprador',
    'vendedor',
    'administrador'
];

const TIPOS_PESSOA_VALIDOS = ['pf', 'pj'];

const STATUS_PEDIDO_VALIDOS = [
    'Aberto',
    'Pago',
    'Cancelado',
    'Enviado'
];

const METODOS_PAGAMENTO_VALIDOS = [
    'Pix',
    'Débito',
    'Crédito',
    'Boleto'
];

const TIPOS_COMPRA_VALIDOS = [
    'Compra',
    'Sob consulta'
];


// ------------------------------------------------------
// VALIDAÇÕES E UTILITÁRIOS
// ------------------------------------------------------

function exigirTexto(valor, campo) {
    if (typeof valor !== 'string' || !valor.trim()) {
        throw new Error(`O campo ${campo} é obrigatório.`);
    }

    return valor.trim();
}

function converterNumero(valor, campo, minimo = 0) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero < minimo) {
        throw new Error(`O campo ${campo} possui um valor inválido.`);
    }

    return numero;
}

function converterId(valor, campo = 'identificador') {
    const numero = Number(valor);

    if (!Number.isSafeInteger(numero) || numero <= 0) {
        throw new Error(`O ${campo} informado é inválido.`);
    }

    return numero;
}

function validarOpcao(valor, opcoes, campo) {
    if (!opcoes.includes(valor)) {
        throw new Error(`O valor informado para ${campo} é inválido.`);
    }

    return valor;
}

function obterIdUsuarioSessao(req) {
    return (
        req.session?.usuario?.id_usuario ??
        req.session?.usuario?.id ??
        null
    );
}

function obterIdAuthSessao(req) {
    return (
        req.session?.usuario?.id_auth ??
        req.session?.usuario?.idAuth ??
        null
    );
}

function verificarPropriaConta(req, usuario) {
    const idSessao = obterIdUsuarioSessao(req);
    const idAuthSessao = obterIdAuthSessao(req);

    const mesmaConta =
        (idSessao !== null &&
            String(idSessao) === String(usuario.id_usuario)) ||
        (idAuthSessao &&
            String(idAuthSessao) === String(usuario.id_auth));

    return Boolean(mesmaConta);
}


// Converte URL pública ou caminho armazenado em um caminho
// relativo ao bucket do Supabase Storage.
function obterCaminhoStorage(valor, nomeBucket) {
    if (!valor || typeof valor !== 'string') {
        return null;
    }

    const caminho = valor.trim();

    if (!caminho) return null;

    const marcador = `/${nomeBucket}/`;

    if (caminho.includes(marcador)) {
        return decodeURIComponent(
            caminho.split(marcador).pop()
        );
    }

    // Se já for um caminho relativo ao bucket.
    if (
        !caminho.startsWith('http://') &&
        !caminho.startsWith('https://')
    ) {
        return caminho.replace(/^\/+/, '');
    }

    // Não tenta remover arquivos de URLs externas.
    return null;
}

async function removerArquivosStorage(nomeBucket, arquivos) {
    const caminhos = [
        ...new Set(
            (arquivos || [])
                .map(arquivo =>
                    obterCaminhoStorage(arquivo, nomeBucket)
                )
                .filter(Boolean)
        )
    ];

    if (caminhos.length === 0) {
        return;
    }

    const { error } = await supabaseAdmin.storage
        .from(nomeBucket)
        .remove(caminhos);

    if (error) {
        console.error(
            `Erro ao remover arquivos do bucket ${nomeBucket}:`,
            error
        );

        throw new Error(
            `Os dados foram excluídos, mas houve uma falha ao remover arquivos do bucket ${nomeBucket}: ${error.message}`
        );
    }
}

async function executarExclusaoRPC(nomeFuncao, id) {
    const { data, error } = await supabaseAdmin.rpc(
        nomeFuncao,
        { p_id: id }
    );

    if (error) {
        throw new Error(
            `Erro ao executar ${nomeFuncao}: ${error.message}`
        );
    }

    return data;
}


// ------------------------------------------------------
// USUÁRIOS
// ------------------------------------------------------

export async function atualizarUsuarioAdmin(req, id) {
    const idUsuario = converterId(id, 'usuário');

    const { data: usuario, error: erroUsuario } = await supabaseAdmin
        .from('usuarios')
        .select(`
            id_usuario,
            id_auth,
            tipo_pessoa,
            login,
            papel
        `)
        .eq('id_usuario', idUsuario)
        .single();

    if (erroUsuario || !usuario) {
        throw new Error('Usuário não encontrado.');
    }

    const nomeCompleto = exigirTexto(
        req.body.nome_completo,
        'nome completo'
    );

    const cpfPessoa = exigirTexto(
        req.body.cpf_pessoa,
        'CPF'
    );

    const login = exigirTexto(
        req.body.login,
        'e-mail'
    ).toLowerCase();

    const tipoPessoa = validarOpcao(
        req.body.tipo_pessoa,
        TIPOS_PESSOA_VALIDOS,
        'tipo de pessoa'
    );

    const papel = validarOpcao(
        req.body.papel,
        PAPEIS_VALIDOS,
        'perfil'
    );

    if (papel === 'vendedor' && tipoPessoa !== 'pj') {
        throw new Error(
            'Somente usuários pessoa jurídica podem ter perfil vendedor.'
        );
    }

    if (
        verificarPropriaConta(req, usuario) &&
        papel !== 'administrador'
    ) {
        throw new Error(
            'Você não pode remover seu próprio perfil de administrador.'
        );
    }

    const { data: empresaVinculada, error: erroEmpresa } =
        await supabaseAdmin
            .from('empresas')
            .select('id_empresa')
            .eq('id_usuario', idUsuario)
            .limit(1)
            .maybeSingle();

    if (erroEmpresa) {
        throw new Error(
            `Erro ao verificar empresa vinculada: ${erroEmpresa.message}`
        );
    }

    if (papel === 'vendedor' && !empresaVinculada) {
        throw new Error(
            'Não é possível definir o perfil vendedor sem uma empresa vinculada.'
        );
    }

    if (papel !== 'vendedor' && empresaVinculada) {
        throw new Error(
            'Este usuário possui uma empresa vinculada. Não altere seu perfil para comprador ou administrador enquanto essa empresa estiver vinculada.'
        );
    }

    const emailAlterado = login !== usuario.login;

    // Atualiza primeiro o e-mail no Supabase Auth.
    if (emailAlterado) {
        const { error: erroAuth } =
            await supabaseAdmin.auth.admin.updateUserById(
                usuario.id_auth,
                {
                    email: login,
                    email_confirm: true
                }
            );

        if (erroAuth) {
            throw new Error(
                `Erro ao atualizar o e-mail no Supabase Auth: ${erroAuth.message}`
            );
        }
    }

    const { error } = await supabaseAdmin
        .from('usuarios')
        .update({
            nome_completo: nomeCompleto,
            cpf_pessoa: cpfPessoa,
            login,
            tipo_pessoa: tipoPessoa,
            papel
        })
        .eq('id_usuario', idUsuario);

    if (error) {
        // Tenta restaurar o e-mail anterior no Auth caso
        // a atualização da tabela usuarios falhe.
        if (emailAlterado) {
            const { error: erroRollback } =
                await supabaseAdmin.auth.admin.updateUserById(
                    usuario.id_auth,
                    {
                        email: usuario.login,
                        email_confirm: true
                    }
                );

            if (erroRollback) {
                console.error(
                    'Falha ao restaurar o e-mail no Auth:',
                    erroRollback
                );
            }
        }

        throw new Error(
            `Erro ao atualizar usuário: ${error.message}`
        );
    }
}


export async function excluirUsuarioAdmin(req, id) {
    const idUsuario = converterId(id, 'usuário');

    const { data: usuario, error } = await supabaseAdmin
        .from('usuarios')
        .select('id_usuario, id_auth, papel')
        .eq('id_usuario', idUsuario)
        .single();

    if (error || !usuario) {
        throw new Error('Usuário não encontrado.');
    }

    if (verificarPropriaConta(req, usuario)) {
        throw new Error(
            'Você não pode excluir sua própria conta administrativa.'
        );
    }

    const resultado = await executarExclusaoRPC(
        'admin_excluir_usuario',
        idUsuario
    );

    await removerArquivosStorage(
        BUCKET_IMAGENS_PRODUTOS,
        resultado?.caminhos_imagens
    );

    await removerArquivosStorage(
        BUCKET_LOGOS_EMPRESAS,
        resultado?.logos_empresas
    );
}


// ------------------------------------------------------
// EMPRESAS
// ------------------------------------------------------

export async function atualizarEmpresaAdmin(req, id) {
    const idEmpresa = converterId(id, 'empresa');

    const razaoSocial = exigirTexto(
        req.body.razao_social,
        'razão social'
    );

    const nomeFantasia = exigirTexto(
        req.body.nome_fantasia,
        'nome fantasia'
    );

    const cnpj = exigirTexto(req.body.cnpj, 'CNPJ');

    const statusConta = validarOpcao(
        req.body.status_conta,
        STATUS_EMPRESA_VALIDOS,
        'status da empresa'
    );

    const { error } = await supabaseAdmin
        .from('empresas')
        .update({
            razao_social: razaoSocial,
            nome_fantasia: nomeFantasia,
            cnpj,
            inscricao_estadual:
                req.body.inscricao_estadual?.trim() || null,
            categoria_empresa:
                req.body.categoria_empresa?.trim() || null,
            tipo_empresa:
                req.body.tipo_empresa?.trim() || null,
            descricao:
                req.body.descricao?.trim() || null,
            site:
                req.body.site?.trim() || null,
            status_conta: statusConta
        })
        .eq('id_empresa', idEmpresa);

    if (error) {
        throw new Error(
            `Erro ao atualizar empresa: ${error.message}`
        );
    }
}


export async function excluirEmpresaAdmin(req, id) {
    const idEmpresa = converterId(id, 'empresa');

    const resultado = await executarExclusaoRPC(
        'admin_excluir_empresa',
        idEmpresa
    );

    await removerArquivosStorage(
        BUCKET_IMAGENS_PRODUTOS,
        resultado?.caminhos_imagens
    );

    await removerArquivosStorage(
        BUCKET_LOGOS_EMPRESAS,
        resultado?.logo_url ? [resultado.logo_url] : []
    );
}


// ------------------------------------------------------
// PRODUTOS
// ------------------------------------------------------

export async function atualizarProdutoAdmin(req, id) {
    const idProduto = converterId(id, 'produto');

    const nomeProduto = exigirTexto(
        req.body.nome_produto,
        'nome do produto'
    );

    const precoUnitario = converterNumero(
        req.body.preco_unitario,
        'preço',
        0.01
    );

    const estoqueAtual = converterNumero(
        req.body.estoque_atual,
        'estoque atual'
    );

    const estoqueMinimo = converterNumero(
        req.body.estoque_minimo || 0,
        'estoque mínimo'
    );

    const fkCategoria = converterId(
        req.body.fk_categoria,
        'categoria'
    );

    const fkVendedor = converterId(
        req.body.fk_vendedor,
        'empresa vendedora'
    );

    const tipoCompra = validarOpcao(
        req.body.tipo_compra,
        TIPOS_COMPRA_VALIDOS,
        'tipo de compra'
    );

    const ativo = req.body.ativo === 'true';

    const { error } = await supabaseAdmin
        .from('produtos')
        .update({
            nome_produto: nomeProduto,
            descricao: req.body.descricao?.trim() || null,
            preco_unitario: precoUnitario,
            estoque_atual: estoqueAtual,
            estoque_minimo: estoqueMinimo,
            fk_categoria: fkCategoria,
            fk_vendedor: fkVendedor,
            tipo_compra: tipoCompra,
            ativo
        })
        .eq('id_produto', idProduto);

    if (error) {
        throw new Error(
            `Erro ao atualizar produto: ${error.message}`
        );
    }
}


export async function excluirProdutoAdmin(req, id) {
    const idProduto = converterId(id, 'produto');

    const resultado = await executarExclusaoRPC(
        'admin_excluir_produto',
        idProduto
    );

    await removerArquivosStorage(
        BUCKET_IMAGENS_PRODUTOS,
        resultado?.caminhos_imagens
    );
}


// ------------------------------------------------------
// PEDIDOS
// ------------------------------------------------------

export async function atualizarPedidoAdmin(req, id) {
    const idPedido = converterId(id, 'pedido');

    const statusPedido = validarOpcao(
        req.body.status_pedido,
        STATUS_PEDIDO_VALIDOS,
        'status do pedido'
    );

    const metodoPagamento = validarOpcao(
        req.body.metodo_pagamento,
        METODOS_PAGAMENTO_VALIDOS,
        'método de pagamento'
    );

    let parcelamento = null;

    if (
        req.body.parcelamento !== undefined &&
        req.body.parcelamento !== ''
    ) {
        parcelamento = converterNumero(
            req.body.parcelamento,
            'parcelamento',
            1
        );

        if (
            !Number.isInteger(parcelamento) ||
            parcelamento > 12
        ) {
            throw new Error(
                'O parcelamento deve ser um número inteiro entre 1 e 12.'
            );
        }
    }

    const { error } = await supabaseAdmin
        .from('pedidos')
        .update({
            status_pedido: statusPedido,
            metodo_pagamento: metodoPagamento,
            parcelamento,
            observacoes: req.body.observacoes?.trim() || null
        })
        .eq('id_pedido', idPedido);

    if (error) {
        throw new Error(
            `Erro ao atualizar pedido: ${error.message}`
        );
    }
}


export async function excluirPedidoAdmin(req, id) {
    const idPedido = converterId(id, 'pedido');

    await executarExclusaoRPC(
        'admin_excluir_pedido',
        idPedido
    );
}
