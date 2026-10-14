import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorioAtual = dirname(fileURLToPath(import.meta.url));
const diretorioRaiz = resolve(diretorioAtual, '..');

const aplicacao = express();
aplicacao.set('view engine', 'ejs');
aplicacao.set('views', resolve(diretorioAtual, 'views'));

aplicacao.use(express.urlencoded({ extended: true }));
aplicacao.use(express.json());
aplicacao.use(express.static(resolve(diretorioRaiz, 'public')));

aplicacao.get('/', (req, res) => {
    res.render('estrutura', {
        titulo: 'Empr-E',
        pagina: 'inicio'
    });
});

aplicacao.use((req, res) => {
    res.status(404).render('estrutura', {
        titulo: 'Página não encontrada',
        pagina: 'nao-encontrada'
    });
});

export default aplicacao;

