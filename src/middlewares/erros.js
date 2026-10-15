import { exibirIndisponibilidade } from '../utils/apresentacao.js';

export function paginaNaoEncontrada(requisicao, resposta) {
  exibirIndisponibilidade(
    requisicao,
    resposta,
    404,
    'Página não encontrada',
    'O endereço ou produto solicitado não existe.',
  );
}

export function tratarErro(erro, requisicao, resposta, proximo) {
  if (resposta.headersSent) return proximo(erro);
  console.error('Falha ao renderizar a página:', erro.message);
  exibirIndisponibilidade(
    requisicao,
    resposta,
    500,
    'Não foi possível carregar a página',
    'Tente novamente em alguns instantes.',
  );
}
