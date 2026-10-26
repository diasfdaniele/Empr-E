
import { exibirIndisponibilidade } from '../utils/apresentacao.js';

// GET /conta/pedidos
export function exibirPedidos(req, res) {
    return exibirIndisponibilidade(req, res);
}
