export function identificador(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim())
    throw new TypeError(`${campo} exige identificador.`);
  return valor.trim();
}

export function inteiroPositivo(valor) {
  if (!Number.isSafeInteger(valor) || valor < 1)
    throw new TypeError('Quantidade deve ser um inteiro positivo.');
  return valor;
}

export function valorMonetario(valor) {
  const centavos = Math.round(valor * 100);
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor < 0 ||
    !Number.isSafeInteger(centavos) ||
    Math.abs(valor * 100 - centavos) > 0.000001
  ) {
    throw new TypeError('Valor deve ser um número não negativo com até duas casas decimais.');
  }
  return centavos / 100;
}

export function calcularSubtotal(precoUnitario, quantidade) {
  const centavos = Math.round(valorMonetario(precoUnitario) * 100) * inteiroPositivo(quantidade);
  if (!Number.isSafeInteger(centavos)) throw new RangeError('Subtotal excede o limite numérico.');
  return centavos / 100;
}

export function somarValores(valores) {
  const centavos = valores.reduce(
    (total, valor) => total + Math.round(valorMonetario(valor) * 100),
    0,
  );
  if (!Number.isSafeInteger(centavos)) throw new RangeError('Total excede o limite numérico.');
  return centavos / 100;
}
