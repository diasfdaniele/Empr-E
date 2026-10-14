import express from 'express';

const aplicacao = express();
aplicacao.set('view engine', 'ejs');
aplicacao.set('views', './src/views');

aplicacao.use('/assets', express.static('./public/assets'));

aplicacao.get('/', (req, res) => {
    res.render('estrutura', {
        titulo: 'Empr-E',
        pagina: 'inicio'
    });
});

export default aplicacao;

