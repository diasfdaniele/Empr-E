const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

//Rotas
const Routes = require('./routes');

//EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Middlewares
app.use(express.urlencoded({ extended: true }));

//Público
app.use(express.static('public'));

//Rotas
app.use('/', Routes);

// Rota 404
app.use((req, res) => {
    res.status(404).render('pages/404', {
        title: 'Página não encontrada'
    });
});

// Inicia servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});