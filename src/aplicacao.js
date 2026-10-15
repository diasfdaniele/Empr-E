import express from 'express';
import { fileURLToPath } from 'node:url';
import rotas from './routes/site.js';
import { paginaNaoEncontrada, tratarErro } from './middlewares/erros.js';

const aplicacao = express();
aplicacao.disable('x-powered-by');
aplicacao.set('view engine', 'ejs');
aplicacao.set('views', fileURLToPath(new URL('./views/', import.meta.url)));
aplicacao.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
aplicacao.use(
  '/assets',
  express.static(fileURLToPath(new URL('../public/assets/', import.meta.url))),
);
aplicacao.use(
  '/bibliotecas',
  express.static(fileURLToPath(new URL('../node_modules/bootstrap/dist/css/', import.meta.url))),
);
aplicacao.use(
  '/icones',
  express.static(fileURLToPath(new URL('../node_modules/lucide-static/icons/', import.meta.url))),
);
aplicacao.use(rotas);
aplicacao.use(paginaNaoEncontrada);
aplicacao.use(tratarErro);

export default aplicacao;
