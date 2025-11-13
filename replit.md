# Sistema de Gestão Intranet Saron

## Visão Geral
Sistema de gestão intranet completo para a loja de roupas Saron, integrado com o ERP Dapic. O sistema oferece dashboards executivos em tempo real, visualização de dados multi-loja, calendário de horários, avisos da direção, chat em tempo real estilo WhatsApp, e sistema de mensagens anônimas.

## Tecnologias
- **Frontend**: React + TypeScript + Vite + Wouter (roteamento) + TailwindCSS + Shadcn/UI
- **Backend**: Node.js + Express + WebSocket
- **Banco de Dados**: PostgreSQL (Neon)
- **Integrações**: API Dapic ERP
- **Real-time**: WebSocket para chat e notificações
- **Estado**: React Query para cache e sincronização

## Estrutura do Projeto

### Schema do Banco de Dados (`shared/schema.ts`)
- **users**: Usuários do sistema com roles (administrador, gerente, vendedor, financeiro)
- **chatMessages**: Mensagens do chat em tempo real
- **scheduleEvents**: Eventos de calendário (horários normais e extras)
- **announcements**: Avisos da direção
- **anonymousMessages**: Mensagens anônimas (funcionários enviam anonimamente, admin vê o remetente)

### Backend
- **server/db.ts**: Conexão com PostgreSQL via Drizzle ORM
- **server/dapic.ts**: Cliente de integração com API Dapic (autenticação JWT, clientes, vendas, produtos, contas a pagar)
- **server/storage.ts**: Interface de acesso a dados do banco
- **server/routes.ts**: APIs REST + WebSocket server
- **server/index.ts**: Servidor Express principal

### Frontend

#### Páginas Principais
- **Dashboard** (`/`): Métricas executivas com dados do Dapic (vendas, clientes, produtos, contas), gráficos interativos
- **Clientes** (`/clientes`): Lista de clientes do Dapic com busca e paginação
- **Vendas** (`/vendas`): Orçamentos/vendas do Dapic com filtros de data e loja
- **Produtos** (`/produtos`): Catálogo de produtos do Dapic com estoque
- **Contas a Pagar** (`/contas-pagar`): Contas a pagar do Dapic com status e vencimentos
- **Calendário** (`/calendario`): Gestão de horários (normais e extras) com visualização mensal/semanal
- **Avisos** (`/avisos`): Painel de comunicados da direção
- **Chat** (`/chat`): Chat em tempo real estilo WhatsApp com WebSocket
- **Mensagem Anônima** (`/anonimo`): Formulário para funcionários enviarem mensagens anônimas; painel admin mostra remetente

#### Componentes
- **AppSidebar**: Navegação lateral com logo Saron e perfil do usuário
- **StoreSelector**: Seletor de loja (individual ou consolidado)
- **ThemeProvider/ThemeToggle**: Suporte a dark mode
- **Diversos cards, formulários e componentes de UI do Shadcn**

#### Hooks Customizados
- `use-users.ts`: Gerenciamento de usuários
- `use-chat.ts`: Mensagens de chat
- `use-schedule.ts`: Eventos de calendário
- `use-announcements.ts`: Avisos
- `use-anonymous-messages.ts`: Mensagens anônimas
- `use-dapic.ts`: Integração com dados do Dapic
- `use-websocket.ts`: Conexão WebSocket para chat em tempo real

#### Contextos
- `user-context.tsx`: Contexto global do usuário logado com role-based access

## Design System
- **Cores Primárias**: Roxo/Magenta inspirado na logo Saron
- **Fontes**: Inter (corpo), Poppins (títulos)
- **Dark Mode**: Suporte completo com toggle
- **Componentes**: Shadcn/UI com customização de cores em `index.css`

## Integrações

### API Dapic
- **Base URL**: https://api.dapic.com.br
- **Autenticação**: Bearer Token JWT (renovação automática antes de expirar)
- **Rate Limit**: 100 requisições/minuto por endpoint
- **Endpoints Integrados**:
  - `/autenticacao/v1/login`: Autenticação
  - `/v1/clientes`: Lista e detalhes de clientes
  - `/v1/orcamentos`: Lista e detalhes de orçamentos/vendas
  - `/v1/produtos`: Lista e detalhes de produtos
  - `/v1/contas-pagar`: Contas a pagar
- **Credenciais**: `DAPIC_EMPRESA` e `DAPIC_TOKEN_INTEGRACAO` (env secrets)

### WebSocket
- **Path**: `/ws`
- **Tipos de Mensagem**: `chat`, `announcement`, `schedule`
- **Conexão**: Autenticada por userId via query param
- **Reconexão**: Automática a cada 3 segundos se desconectar

## Roles e Permissões
- **Administrador**: Acesso total, vê remetentes de mensagens anônimas
- **Gerente**: Acesso a dashboards, vendas, clientes, produtos
- **Vendedor**: Acesso a clientes, vendas, calendário, chat
- **Financeiro**: Acesso a contas a pagar, dashboards financeiros

## Estado Atual (13 Nov 2025)

### Completado ✅
✅ Schema do banco de dados PostgreSQL com Drizzle ORM
✅ Backend completo com integração Dapic multi-loja (Saron 1, 2, 3)
✅ WebSocket server para chat em tempo real
✅ Storage layer com todas as operações CRUD
✅ Todas as 9 páginas do frontend implementadas
✅ Sistema de design com cores Saron (roxo/magenta)
✅ Hooks React Query para todos os endpoints
✅ Contexto de usuário global com roles
✅ Dark mode completo
✅ Sidebar de navegação com logo Saron
✅ Seletor multi-loja dinâmico (busca lojas disponíveis do backend)
✅ Integração com as 3 lojas Saron via API Dapic
✅ Autenticação JWT separada por loja com cache de tokens
✅ Endpoint consolidado "Todas as Lojas" para visão geral
✅ Tratamento de erros em todas as rotas
✅ Axios instalado para chamadas HTTP

### Mudanças Recentes (13 Nov 2025 17:40)
- ✅ Dashboard conectado aos dados reais do Dapic com métricas consolidadas
- ✅ Páginas Clientes, Vendas, Produtos, Contas a Pagar conectadas aos hooks useDapic*
- ✅ Tratamento de erros consolidados exibido ao usuário
- ✅ Loading states e skeleton placeholders em todas as páginas
- ✅ StoreSelector funcional em Dashboard e páginas Dapic
- ✅ Normalização de dados e proteção contra valores nulos/undefined
- 🔄 Em progresso: Conectar Chat, Calendário, Avisos e Mensagens Anônimas ao backend

### Próximos Passos
- Conectar Chat ao backend real com WebSocket
- Conectar Calendário, Avisos e Mensagens Anônimas ao PostgreSQL
- Implementar sistema de notificações em tempo real
- Criar módulo de relatórios personalizáveis
- Implementar sistema de metas e KPIs

## Como Executar
1. Variáveis de ambiente já configuradas (DATABASE_URL, DAPIC_EMPRESA, DAPIC_TOKEN_INTEGRACAO, SESSION_SECRET)
2. Workflow "Start application" já está rodando (`npm run dev`)
3. Acesso: http://localhost:5000

## Notas Técnicas
- Frontend e backend servidos na mesma porta (5000) via Vite proxy
- WebSocket usa mesma porta do HTTP server
- React Query com cache automático de dados do Dapic
- Usuário demo criado automaticamente no contexto (pode ser substituído por autenticação real posteriormente)
- Mensagens anônimas: funcionários enviam sem revelar identidade, mas admin vê userId do remetente no banco
