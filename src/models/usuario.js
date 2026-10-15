import { identificador } from '../utils/validacao.js';

export const tiposPessoa = Object.freeze(['pf', 'pj']);
export const papeisUsuario = Object.freeze(['comprador', 'vendedor', 'administrador']);

export class Usuario {
  constructor({ id, tipoPessoa, papel, empresaId = null }) {
    this.id = identificador(id, 'Usuário');
    if (!tiposPessoa.includes(tipoPessoa) || !papeisUsuario.includes(papel))
      throw new TypeError('Tipo de pessoa ou papel inválido.');
    if (papel === 'vendedor' && (tipoPessoa !== 'pj' || !empresaId))
      throw new TypeError('Vendedor deve ser pessoa jurídica vinculada a uma empresa.');
    if (tipoPessoa === 'pf' && empresaId !== null)
      throw new TypeError('Pessoa física não possui vínculo de empresa neste perfil.');
    this.tipoPessoa = tipoPessoa;
    this.papel = papel;
    this.empresaId = empresaId === null ? null : identificador(empresaId, 'Empresa');
    Object.freeze(this);
  }

  get podeVender() {
    return this.tipoPessoa === 'pj' && this.papel === 'vendedor';
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
