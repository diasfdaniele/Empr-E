import express from 'express';

const aplicacao = express();
aplicacao.set('view engine', 'ejs');
aplicacao.set('views', './src/views');

aplicacao.get('/', (req, res) => {
    res.render('paginas/inicio', {
        titulo: 'Empr-E'
    });
});

export default aplicacao;

