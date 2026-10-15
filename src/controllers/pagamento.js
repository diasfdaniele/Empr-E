import { obterPagamentoExemplo } from '../models/pagamento.js';
import { renderizarPagina } from '../utils/apresentacao.js';

export function exibirPagamento(req, res) {
  const exemplo = obterPagamentoExemplo();
  renderizarPagina(res, 'pagamento', 'Pagamento ilustrativo | Empr-E', exemplo);
}
