import { obterPagamentoExemplo } from '../models/pagamento.js';
import { renderizarPagina } from '../utils/apresentacao.js';

export function exibirPagamento(requisicao, resposta) {
  const exemplo = obterPagamentoExemplo();
  renderizarPagina(resposta, 'pagamento', 'Pagamento ilustrativo | Empr-E', exemplo);
}
