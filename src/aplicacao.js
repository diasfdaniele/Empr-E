//aplicacao.js
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import rotas from './routes/site.js';
import session from 'express-session';
import { paginaNaoEncontrada, tratarErro } from './middlewares/erros.js';

const aplicacao = express();
aplicacao.use(express.static('public'));
aplicacao.disable('x-powered-by');
aplicacao.set('view engine', 'ejs');
aplicacao.use(express.urlencoded({extended: true}));
aplicacao.use(
  session({
    name: 'empre.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
aplicacao.use((req, res, next) => {
  res.locals.erro = null;
  res.locals.usuarioSessao = req.session.usuario ?? null;
  next();
});
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
aplicacao.use((req, res, next) => {
    res.locals.usuarioLogado = Boolean(
        req.session?.usuario &&
        req.session?.tokens?.accessToken
    );

    next();
});

aplicacao.use(rotas);
aplicacao.use(paginaNaoEncontrada);
aplicacao.use(tratarErro);

export default aplicacao;
