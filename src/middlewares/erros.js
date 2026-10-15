import { exibirIndisponibilidade } from '../utils/apresentacao.js';

export function paginaNaoEncontrada(req, res) {
  exibirIndisponibilidade(
    req,
    res,
    404,
    'Página não encontrada',
    'O endereço ou produto solicitado não existe.',
  );
}

export function tratarErro(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error('Falha ao renderizar a página:', err.message);
  exibirIndisponibilidade(
    req,
    res,
    500,
    'Não foi possível carregar a página',
    'Tente novamente em alguns instantes.',
  );
}
