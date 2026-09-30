# ECOM — plataforma central para vendedores multicanal

Aplicativo desktop web que centraliza produtos, anúncios, pedidos, vendas e estoque de Mercado Livre, Shopee e Amazon. Sem dados fictícios: tudo que não tiver registro real mostra estado vazio com ação clara.

## Visual

- Fundo grafite/cinza frio escuro, superfícies em vidro fosco discreto, destaque verde-petróleo, sem roxo.
- Tipografia Geist (texto) e Geist Mono (números, códigos).
- Sidebar fixa com a marca ECOM e cabeçalho compacto: título da página, busca contextual, notificações e perfil.
- Alta densidade de informação, bordas suaves, foco em telas de notebook e monitor.

## Navegação

Visão geral, Vendas, Pedidos, Produtos, Anúncios, Estoque, Integrações, IA ECOM, Configurações. Sem Clientes, sem Comunidade, sem marketplace "Outros"/"Manual", sem criação manual de pedidos ou vendas.

## Contas e primeiro acesso

- Cadastro com nome, e-mail, senha e CPF; login por e-mail e senha; recuperação de senha; sessão que permanece; todas as telas internas protegidas.
- Onboarding após o primeiro acesso: já vende online, quais marketplaces usa, ativar o assistente de IA, preferências do painel.

## Módulos

- **Visão geral**: blocos de vendas, produtos cadastrados, anúncios ativos/pausados, resumo de estoque, pedidos recentes, alertas e resumo por marketplace — cada bloco com seu próprio estado vazio.
- **Vendas**: lista enxuta (data, pedido, produto, comprador, canal, valor, status) e painel lateral com detalhes do pedido.
- **Pedidos**: lista com busca, filtros e página de detalhe, alimentada só pelas integrações.
- **Produtos**: cadastro completo (nome, código de barras, fotos, descrição, categoria, marca, peso, dimensões, preço, estoque, variações, SKU), upload real de imagens, busca/filtros e menu de ações estável (abrir, editar, duplicar, excluir com confirmação).
- **Anúncios**: partindo de um produto central, escolher canais, ajustar título/descrição/categoria/preço/estoque por canal, validar campos obrigatórios, salvar rascunho e preparar publicação com erros por canal.
- **Estoque**: saldo central por produto/variação, histórico de movimentações, alertas de estoque baixo e base pronta para reenviar saldo aos canais após venda, ajuste ou entrada.
- **Integrações**: apenas os três canais, com estados desconectado/conectando/conectado/erro, dados da conta, última sincronização e desconexão. Chaves e tokens ficam só no servidor; nenhuma conexão é simulada.
- **IA ECOM**: chat do assistente com histórico de comandos e as capacidades pedidas. Sem provedor configurado, a tela explica o que falta em vez de inventar respostas.
- **Configurações**: conta e perfil, segurança, preferências, IA, integrações, notificações e dados da empresa.

## Dados

Banco com as tabelas pedidas (profiles, seller_settings, marketplace_connections, products, product_variants, product_images, marketplace_listings, orders, order_items, sales, inventory_balances, inventory_movements, ai_conversations, ai_messages, sync_logs, alerts), identificadores UUID, datas de criação/atualização e regras de acesso para que cada usuário veja somente os próprios dados. Ativarei o backend do Lovable (banco, login, armazenamento de arquivos e funções de servidor) para isso.

## Detalhes técnicos

- TanStack Start + TypeScript + Tailwind + shadcn/ui; tokens de design em `src/styles.css`.
- Lovable Cloud: Postgres com RLS por `user_id`, bucket de imagens de produto, autenticação e server functions.
- Trigger de criação de perfil no primeiro acesso; `seller_settings` guarda respostas do onboarding e preferências.
- Venda registrada dispara movimentação de estoque e enfileira sincronização (`sync_logs`) para os canais conectados.
- OAuth dos marketplaces com rotas de callback server-side e tokens gravados apenas no backend.
- IA via gateway do Lovable em server function, com verificação de configuração antes de responder.

## Ordem de entrega

1. Design system + shell e navegação
2. Autenticação, onboarding e proteção de rotas
3. Banco e RLS
4. Produtos (CRUD, imagens, variações)
5. Anúncios por marketplace
6. Integrações
7. Pedidos/Vendas/Estoque
8. IA ECOM
9. Configurações e revisão dos estados vazios
