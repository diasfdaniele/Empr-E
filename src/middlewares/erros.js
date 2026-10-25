//Middleware erros
import { exibirIndisponibilidade, renderizarPagina } from '../utils/apresentacao.js';

export function paginaNaoEncontrada(req, res) {
  res.status(404);
  renderizarPagina(res, 'nao-encontrada', 'Página não encontrada | Empr-E');
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
