import aplicacao from './aplicacao.js';

const porta = 3001;

aplicacao.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});