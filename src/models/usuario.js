//Model usuario
import { identificador } from '../utils/validacao.js';

export const tiposPessoa = Object.freeze(['pf', 'pj']);
export const papeisUsuario = Object.freeze(['comprador', 'vendedor', 'administrador']);

export class Usuario {
  constructor({
    id,
    idAuth,
    tipoPessoa,
    login,
    nomeCompleto,
    cpfPessoa,
    criadoEm = null,
    empresa = null,
  }) {
    const idNumerico = Number(id);

    if (!Number.isSafeInteger(idNumerico) || idNumerico < 1) {
      throw new TypeError('ID do usuário inválido.');
    }

    if (!tiposPessoa.includes(tipoPessoa)) {
      throw new TypeError('Tipo de pessoa inválido.');
    }

    if (!idAuth || typeof idAuth !== 'string') {
      throw new TypeError('Identificador do Supabase Auth inválido.');
    }

    if (!login || !nomeCompleto || !cpfPessoa) {
      throw new TypeError('Os dados pessoais obrigatórios estão ausentes.');
    }

    if (tipoPessoa === 'pf' && empresa !== null) {
      throw new TypeError(
        'Pessoa física não pode possuir vínculo empresarial neste perfil.'
      );
    }

    this.id = idNumerico;
    this.idAuth = idAuth;
    this.tipoPessoa = tipoPessoa;
    this.login = login;
    this.nomeCompleto = nomeCompleto;
    this.cpfPessoa = cpfPessoa;
    this.criadoEm = criadoEm;
    this.empresa = empresa;

    Object.freeze(this);
  }

  get podeComprar() {
    return true;
  }

  get podeVender() {
    return (
      this.tipoPessoa === 'pj' &&
      this.empresa !== null &&
      this.empresa.statusConta === 'Ativo'
    );
  }
}

export const tiposEndereco = Object.freeze(['sede', 'entrega', 'faturamento']);

export class Endereco {
  constructor({
    id,
    usuarioId,
    tipo,
    cep,
    logradouro,
    numero = '',
    bairro,
    cidade,
    estado,
    complemento = '',
  }) {
    this.id = identificador(id, 'Endereço');
    this.usuarioId = identificador(usuarioId, 'Usuário');
    if (!tiposEndereco.includes(tipo)) throw new TypeError('Tipo de endereço inválido.');
    if (!/^\d{8}$/.test(cep) || !/^[A-Z]{2}$/.test(estado))
      throw new TypeError('CEP ou UF inválido.');
    this.tipo = tipo;
    this.cep = cep;
    this.logradouro = identificador(logradouro, 'Logradouro');
    this.numero = String(numero);
    this.bairro = identificador(bairro, 'Bairro');
    this.cidade = identificador(cidade, 'Cidade');
    this.estado = estado;
    this.complemento = String(complemento);
    Object.freeze(this);
  }
}

export const tiposContato = Object.freeze(['telefone', 'email', 'whatsapp']);

export class Contato {
  constructor({ id, usuarioId, tipo, valor }) {
    this.id = identificador(id, 'Contato');
    this.usuarioId = identificador(usuarioId, 'Usuário');
    if (!tiposContato.includes(tipo)) throw new TypeError('Tipo de contato inválido.');
    this.tipo = tipo;
    this.valor = identificador(valor, 'Contato');
    Object.freeze(this);
  }
}

export class Favorito {
  constructor({ usuarioId, produtoId }) {
    this.usuarioId = identificador(usuarioId, 'Usuário');
    this.produtoId = identificador(produtoId, 'Produto');
    Object.freeze(this);
  }
}
