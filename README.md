# Empr-E

Este projeto foi desenvolvido como parte integrante do Projeto de Extensão do 4º Semestre do Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas do IFSP - Campinas.

Este sistema é uma nova fase da plataforma Empr-E desenvolvida no 1° Semestre de 2026, que anteriormente foi pensada como um marketplace B2B, mas que agora passa a ser uma plataforma de e-commerce mais abrangente, acessível e robusta, com vendas para empresas e usuários finais.

## Link de acesso

Em desenvolvimento.

## Sobre o Projeto

A **Empr-E** é uma plataforma de e-commerce dedicada à democratização de produtos e soluções de acessibilidade e inclusão.

Em sua primeira versão, ela foi desenvolvida com foco no modelo B2B, conectando empresas fornecedoras a empresas interessadas em adquirir produtos e soluções de acessibilidade.

Nesta nova fase, a Empr-E será ampliada para atender também usuários finais, permitindo que diferentes perfis de clientes possam encontrar, consultar e adquirir produtos em um único ambiente centralizado.

A evolução do sistema também contempla uma nova estrutura técnica, com a inclusão de um backend próprio e banco de dados, compatíveis com os novos conhecimentos adquiridos na disciplina de Desenvolvimento Web 2.

Além disso, a Empr-E mantém a acessibilidade, a usabilidade e a experiência do usuário como princípios fundamentais ao projeto, buscando oferecer uma plataforma intuitiva e acessível.

## Objetivos

A nova fase da Empr-E busca:

1. Ampliar a plataforma para atender empresas e usuários finais;
2. Facilitar o acesso a produtos e soluções de acessibilidade;
3. Conectar fornecedores a diferentes perfis de compradores;
4. Melhorar o gerenciamento de usuários, produtos, pedidos e vendas;
5. Implementar um backend para gerenciamento das regras e operações do sistema;
6. Utilizar um banco de dados para armazenamento e gerenciamento das informações;
7. Integrar serviços de pagamento por meio de API;
8. Oferecer uma experiência digital acessível, intuitiva e eficiente;
9. Aplicar conceitos de arquitetura de software, banco de dados e desenvolvimento web.

## Funcionalidades

O catálogo demonstrativo oferece busca, filtros por categoria, empresa e preço,
além de páginas de detalhe com variações e imagens locais. O carrinho e o checkout
exibem exemplos independentes: as interações são temporárias, não criam pedidos e
não realizam cobranças. Cadastro, login, conta, administração, favoritos persistidos,
histórico e painel do vendedor estão indisponíveis nesta fase.

Pessoas físicas e jurídicas poderão comprar; somente pessoas jurídicas poderão
vender. Essa regra está preparada na interface e nos contratos do model, mas ainda
não representa autenticação ou autorização implementada.

## Arquitetura do Sistema

Nesta nova fase, a Empr-E passa a utilizar uma arquitetura composta por:

* **Frontend:** responsável pela interface e interação com os usuários;
* **Backend:** responsável pelas regras de negócio, processamento das requisições e comunicação entre as diferentes partes do sistema;
* **Banco de Dados:** responsável pelo armazenamento e gerenciamento das informações;
* **API de Pagamento:** responsável pela integração com serviços de pagamento.

O backend está sendo organizado com base no padrão arquitetural **MVC (Model-View-Controller)**.

## Tecnologias Utilizadas

Em desenvolvimento.

## Estrutura do Projeto

O backend Express renderiza páginas EJS e segue MVC. Os seis módulos principais, são usuário, produto, empresa, pedido, pagamento e vendas Endereços, contatos e favoritos ficam com usuário; carrinho, itens e orçamento ficam com pedido. Views compartilhadas ficam em `src/views/partials`.

O CSS, as imagens e as interações do navegador ficam em `public/assets/`. O HTML usa as classes Bootstrap necessárias para manter o layout existente. Os dados dos models são demonstrações em memória: não há persistência nem conexão ao banco por enquanto.

## Banco de Dados

Em desenvolvimento.

## Como Executar o Projeto

Requisito: Node.js 24 ou superior. Na raiz do projeto, instale as dependências registradas no lockfile e inicie o servidor:

```bash
npm ci
npm start
```

O endereço padrão é http://localhost:3000. Para desenvolvimento com reinício automático após alterações em JavaScript:

```bash
npm run dev
```

Para usar outra porta, defina `PORT` no ambiente antes de iniciar. Não é necessário criar um arquivo `.env` nem configurar banco para executar a demonstração.

Para executar no VSCode, no terminal de comando use: 
```bash
node src/servidor.js
``` 

## Projeto Acadêmico

A Empr-E é um projeto acadêmico desenvolvido por alunos do curso de **Análise e Desenvolvimento de Sistemas do IFSP - Campinas**, tendo como objetivo aplicar conhecimentos de Desenvolvimento Web 2, Engenharia de Software 2, Redes de Computadores e Gestão de TI em um projeto prático.

A nova fase representa a evolução da plataforma desenvolvida anteriormente. 

## Licença

Este projeto foi desenvolvido para fins acadêmicos e educacionais, sem fim lucrativo.

Todos os direitos pertencem aos respectivos autores.
