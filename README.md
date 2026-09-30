# Ecom

Crie um aplicativo desktop web chamado ECOM para vendedores de e-commerce que operam em múltiplos marketplaces.

OBJETIVO CENTRAL
A ECOM deve centralizar produtos, anúncios, pedidos, vendas e estoque de Mercado Livre, Shopee e Amazon em um único sistema. O estoque é central: quando uma venda ocorre em qualquer marketplace, o estoque central deve ser atualizado e posteriormente sincronizado com os demais canais conectados. Não criar fluxo de pedidos manuais.

ESCOPO INICIAL
Construir uma base funcional e profissional, preparada para dados reais, sem popular a aplicação com dados fictícios. Quando ainda não houver integrações ou registros reais, mostrar estados vazios bem desenhados com CTA apropriado.

TECNOLOGIA
Use o stack padrão full-stack do Lovable com TypeScript, Tailwind e shadcn/ui. Prepare integração com PostgreSQL/Supabase, autenticação, storage e RLS. Estruture o código para integrações reais via OAuth, APIs, webhooks e funções server-side.

AUTENTICAÇÃO
Criar:
- Cadastro de conta
- Login
- Recuperação de senha
- Sessão persistente
- Proteção das rotas internas
- Perfil do usuário
Cadastro deve suportar nome, e-mail, senha e CPF. CPF pertence ao cadastro/perfil; login principal por e-mail e senha.
Após o primeiro acesso, criar onboarding perguntando:
- se já vende online;
- quais marketplaces utiliza: Mercado Livre, Shopee, Amazon;
- se deseja ativar o assistente de IA;
- preferências básicas do painel.

NAVEGAÇÃO DESKTOP
Sidebar fixa com marca ECOM e itens:
1. Visão geral
2. Vendas
3. Pedidos
4. Produtos
5. Anúncios
6. Estoque
7. Integrações
8. IA ECOM
9. Configurações
Não criar módulo Clientes.
Não criar comunidade.
Não criar entrada "Outros" nem "Manual" em marketplaces.

DESIGN
Aplicação somente desktop nesta fase.
Visual profissional de SaaS:
- fundo grafite/cinza frio escuro;
- superfícies em frosted glass discretas;
- destaque verde-petróleo;
- tipografia Geist e Geist Mono;
- alta densidade de informação sem poluição;
- bordas suaves;
- ícones simples;
- sidebar fixa;
- cabeçalho compacto com título da página, pesquisa contextual, notificações e perfil.
Não usar roxo como cor principal.
Priorizar legibilidade e aparência corporativa.

VISÃO GERAL
Mostrar somente dados reais provenientes do banco e integrações. Criar áreas para:
- visão geral das vendas;
- quantidade de produtos cadastrados;
- anúncios ativos e pausados;
- resumo de estoque;
- pedidos recentes;
- alertas e pendências;
- resumo por marketplace.
Se não houver dados, mostrar estado vazio; não simular métricas.

VENDAS
Página objetiva, sem dashboards excessivos.
Exibir tabela/lista somente das vendas sincronizadas dos marketplaces.
Campos sugeridos:
- data;
- pedido;
- produto;
- comprador;
- marketplace;
- valor;
- status;
- ação "Abrir venda".
Ao abrir venda, mostrar drawer/modal com informações disponíveis do comprador, itens, valores, marketplace, endereço quando permitido pela integração e histórico do pedido.
Não incluir botão "Nova venda".

PEDIDOS
Pedidos vêm exclusivamente das integrações dos marketplaces.
Criar lista com busca, filtros, status e página de detalhes.
Não permitir cadastro manual de pedido.

PRODUTOS
Criar CRUD funcional de produto central com:
- nome;
- código de barras;
- fotos;
- descrição;
- categoria;
- marca;
- peso;
- dimensões;
- preço;
- estoque;
- variações;
- SKU.
Permitir upload real de imagens para storage.
Tela principal com busca, filtros e tabela de produtos.
Menu de três pontos por produto deve ser estável, previsível e acessível, com ações como abrir, editar, duplicar e excluir mediante confirmação.

ANÚNCIOS
Conceito principal: o usuário cadastra o produto uma vez e gera anúncios específicos para os marketplaces escolhidos.
Fluxo:
- escolher produto central;
- escolher Mercado Livre, Shopee e/ou Amazon;
- adaptar automaticamente informações por canal;
- permitir título e descrição próprios por marketplace;
- mapear categoria correspondente;
- configurar preço e estoque;
- validar campos obrigatórios;
- salvar como rascunho;
- preparar publicação;
- mostrar erros por canal.
Criar estrutura de dados separando produto central de anúncio por marketplace.

ESTOQUE
Criar estoque central por produto/variação.
Registrar movimentações.
Preparar sincronização para atualizar estoque nos marketplaces conectados após venda, ajuste ou entrada.
Mostrar alertas de estoque baixo.
Nunca gerar movimentações fictícias.

INTEGRAÇÕES
Página com cartões apenas para:
- Mercado Livre
- Shopee
- Amazon
Cada integração deve ter estados desconectado/conectando/conectado/erro, CTA de conexão, informações da conta quando disponíveis, última sincronização e ação para desconectar.
Preparar arquitetura OAuth e armazenamento seguro de tokens no backend; não colocar segredos no frontend.
Não inventar integrações concluídas sem credenciais.

IA ECOM
Criar interface de agente de IA voltado ao e-commerce, preparado para executar:
- criar anúncios;
- melhorar títulos;
- gerar descrições;
- sugerir categorias;
- identificar informações faltantes;
- sugerir preço com base apenas em dados disponíveis;
- analisar erros dos anúncios;
- sugerir melhorias;
- consultar produtos e estoque;
- preparar publicação;
- explicar problemas encontrados.
Criar histórico de comandos da IA.
Nesta primeira versão, implementar a interface e a arquitetura de chamadas server-side sem chaves hardcoded. Se nenhum provedor/chave estiver configurado, mostrar configuração necessária em vez de respostas fictícias.

CONFIGURAÇÕES
Criar:
- conta e perfil;
- segurança;
- preferências;
- configurações da IA;
- integrações;
- notificações;
- dados da empresa quando necessário.

BANCO DE DADOS
Modelar tabelas relacionais reais para pelo menos:
profiles
seller_settings
marketplace_connections
products
product_variants
product_images
marketplace_listings
orders
order_items
sales
inventory_balances
inventory_movements
ai_conversations
ai_messages
sync_logs
alerts
Usar UUIDs, timestamps e user_id/owner_id conforme necessário.
Aplicar RLS para que cada usuário acesse somente seus próprios dados.

QUALIDADE
- Não usar dados mockados permanentes.
- Não esconder erros.
- Criar estados: loading, vazio, erro e sucesso.
- Formulários com validação.
- Confirmação em ações destrutivas.
- Componentes reutilizáveis.
- Rotas protegidas.
- Layout responsivo apenas o suficiente para diferentes tamanhos de notebook/monitor, mantendo foco desktop.

ORDEM DE IMPLEMENTAÇÃO NESTE PRIMEIRO BUILD
1. Shell visual completo e navegação.
2. Autenticação e rotas protegidas.
3. Banco e RLS.
4. Produtos CRUD + imagens + variações.
5. Estrutura Produto Central -> Anúncios por Marketplace.
6. Integrações com os três marketplaces em estado realista, sem simular conexão.
7. Pedidos/Vendas/Estoque preparados para sincronização real.
8. IA ECOM com interface e backend preparado para provedor configurável.
9. Configurações.
10. Estados vazios profissionais em toda a aplicação.

Ao final, revise toda a navegação e garanta que não existam módulos Clientes, Comunidade, pedidos manuais, vendas manuais, marketplace "Outros" ou "Manual".

Este projeto nasceu no [Lovable](https://lovable.dev) (o prompt original acima) e depois foi migrado para rodar **100% local**: sem Supabase, sem Lovable, sem depender de internet. Autenticação, dados e upload de imagem ficam num banco SQLite em disco (`data/ecom.db`).

## Rodando localmente

**Pré-requisitos:** [Node.js 22 ou mais novo](https://nodejs.org/) (usa o módulo nativo `node:sqlite`, sem dependência nativa pra compilar) e `npm`.

```sh
git clone https://github.com/PeMagro/ecom-local.git
cd ecom-local
npm install

# copie o exemplo e gere seu próprio segredo de sessão
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# cole o resultado no SESSION_SECRET do .env

npm run db:init   # cria o banco SQLite em data/ecom.db (idempotente)
npm run dev       # sobe o servidor — normalmente em http://localhost:8080
```

Abra a URL que aparecer no terminal, crie uma conta em `/auth` e comece a usar. Tudo fica salvo localmente na sua máquina (`data/ecom.db` e `public/uploads/`) — cada pessoa que clonar o repositório tem o próprio banco, ninguém compartilha dados.

**Opcional:** as integrações com Mercado Livre/Shopee/Amazon e o assistente de IA (ECO) exigem chaves próprias — veja os comentários em `.env.example` para a lista completa. Sem elas, essas telas mostram "não configurado" em vez de quebrar.
