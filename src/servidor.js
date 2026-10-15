import aplicacao from './aplicacao.js';

const porta = Number(process.env.PORT) || 3000;

aplicacao.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});