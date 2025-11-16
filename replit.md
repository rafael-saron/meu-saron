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
  - `/v1/orcamentos`: Lista e detalhes de orçamentos (⚠️ **LIMITAÇÃO**: retorna apenas cotações, NÃO vendas finalizadas do PDV)
  - `/v1/produtos`: Lista e detalhes de produtos
  - `/v1/contas-pagar`: ❌ Endpoint não existe (retorna 404)
- **Credenciais**: `DAPIC_EMPRESA` e `DAPIC_TOKEN_INTEGRACAO` (env secrets)

#### ✅ **SOLUÇÃO ENCONTRADA - Vendas do PDV (16 Nov 2025)**
**Descoberta**: O endpoint correto para vendas PDV é `/v1/vendaspdv` (sem hífen, tudo junto). Testes anteriores falharam porque usavam `/v1/vendas-pdv` (com hífen).

**Integração implementada**:
- ✅ Método `getVendasPDV()` em `server/dapic.ts` com parâmetros padrão:
  - `FiltrarPor='0'` - Filtrar por data de fechamento
  - `Status='1'` - Apenas vendas fechadas
  - `RegistrosPorPagina='200'` - **CRÍTICO**: API limita a 200 registros/página (não 1000)
  - `DataInicial='01/01/2020'` - Dados desde 2020
  - **Paginação Automática**: Loop sequencial que busca todas as páginas até limite de 50 páginas (10.000 registros)
  - **Performance**: ~2 minutos para buscar todo histórico (50 páginas × 200 registros)
- ✅ Rota backend `/api/dapic/:storeId/vendaspdv`
- ✅ Hook frontend `useDapicVendasPDV` com React Query
- ✅ Dashboard atualizado para usar vendas PDV reais
- ✅ Normalização de moeda: `ValorLiquido` pode vir como número ou string brasileira, tratado em todos os cálculos
- ✅ Aviso de limitação removido do dashboard

**Estrutura dos dados PDV**:
- Array: `Dados` (não `Resultado`)
- Campos: `ValorLiquido`, `DataFechamento`, `Vendedor`, `Status`, `NFCE`, `Cliente`
- Valores monetários normalizados com `parseBrazilianCurrency` para compatibilidade

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

### Mudanças Recentes (14 Nov 2025)
- ✅ **Sistema de Vendas por Período com Filtro de Roles**:
  - Campo `storeId` (nullable text) adicionado ao schema users para vincular gerentes/vendedores a lojas específicas
  - Admin sem storeId: vê seletor multi-loja (pode trocar entre todas/saron1/saron2/saron3)
  - Gerente/Vendedor com storeId: fixados na sua loja, seletor oculto
  - Função `parseBrazilianDate()` com validação robusta:
    - Valida ranges: dia 1-31, mês 1-12, ano 1900-2100
    - Detecta rollover inválido (ex: 32/13/2024 retorna null)
    - Suporta formatos ISO (yyyy-mm-dd) e brasileiro (dd/mm/yyyy)
  - Helpers de filtro temporal: `isSameDay()`, `isInCurrentWeek()`, `isInCurrentMonth()`
  - Cards de vendas: Hoje, Semana (domingo a sábado), Mês atual
  - Valores formatados em BRL com 2 decimais
  - **Role Scoping Seguro**: 
    - selectedStore inicia como "" (falsy) para prevenir queries prematuras
    - useEffect define selectedStore após user carregar
    - Todos hooks useDapic têm `enabled: !!storeId` para bloquear queries até selectedStore estar pronto
    - Elimina race condition entre carregamento de user e disparo de queries
  - Usuário demo mudado para role administrador (era vendedor)
  - ✅ Testado com e2e: todos cards visíveis, formatação BRL correta, role scoping funcionando
- ✅ **Dados Históricos Dapic**: DataInicial=2020-01-01 em todos os endpoints (clientes, orçamentos, produtos, contas-pagar)
- ✅ **Sistema de Gestão de Usuários Completo**:
  - Página /usuarios com CRUD completo (criar, editar, deletar, listar)
  - Upload de foto de perfil
  - Reset de senha por admins
  - Hash de senha com bcrypt (10 salt rounds)
  - Validação Zod em todas as mutações
  - Usuário admin criado automaticamente (username: admin, password: admin123) - **IMPORTANTE: trocar senha após primeiro login**
  - Menu "Usuários" visível apenas para administradores
  - Soft delete (isActive=false) em vez de exclusão física
- ✅ **Contador de Mensagens Não Lidas no Chat**:
  - Badge no sidebar exibindo número de mensagens não lidas
  - Backend endpoint GET /api/chat/unread-count/:userId (sem auto-mark)
  - Backend endpoint POST /api/chat/mark-as-read (marca como lido explicitamente)
  - Frontend hook useUnreadCount com polling de 5 segundos (fallback)
  - **WebSocket global** no App.tsx para atualizações em tempo real
  - **Mutation explícita** dispara em toda conversa aberta + nova mensagem
  - Debounce de 100ms previne chamadas excessivas
  - Tracking por `${selectedUserId}-${lastMessageId}` detecta mudanças
  - Suporte multi-tab (invalidação para sender e receiver)
  - **Limitação conhecida**: Falhas de mutation requerem troca de conversa para retry (baixo impacto, coberto por polling/WebSocket)
- ✅ **Correções de Tipo**: fullName (não name), content (não message)
- ✅ **Segurança Melhorada**:
  - Validação de campos permitidos em PATCH /api/users/:id
  - Hash automático de senhas em createUser e updateUser
  - Validação Zod em todos os endpoints de mutação
- ✅ WebSocket corrigido para usar window.location.host
- ✅ **Integração Vendas PDV Dapic (16 Nov 2025)**:
  - ✅ Descoberto endpoint correto: `/v1/vendaspdv` (sem hífen)
  - ✅ Implementado `getVendasPDV()` em `server/dapic.ts` com paginação automática
  - ✅ **CORREÇÃO CRÍTICA (16 Nov 2025)**: Paginação completa implementada
    - Problema: API retornava apenas 200 registros por loja (limitação de 200 registros/página)
    - Solução: Implementada paginação automática sequencial que busca todas as páginas
    - Lojas individuais: Pagina até 50 páginas × 200 registros = 10.000 vendas
    - Modo consolidado ("todas"): **Paralelização com Promise.all** - busca todas as lojas simultaneamente
    - Performance: ~2min para consolidado (3 lojas em paralelo) vs ~7.5min sequencial
  - ✅ Rota backend `/api/dapic/:storeId/vendaspdv` criada
  - ✅ Hook `useDapicVendasPDV` com React Query
  - ✅ Dashboard atualizado para exibir vendas PDV reais em vez de orçamentos
  - ✅ Normalização de moeda robusta: trata ValorLiquido como número ou string brasileira
  - ✅ Aviso de limitação removido do dashboard
  - ✅ Dados consolidados e por loja funcionando com paginação completa
  - ✅ Cards de período (Hoje, Semana, Mês) com valores PDV reais e precisos
  - ✅ Gráficos usando DataFechamento e ValorLiquido
- ✅ **Sistema de Autenticação Completo (16 Nov 2025)**:
  - ✅ Página de login (`/login`) com formulário de usuário e senha
  - ✅ Backend endpoints: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
  - ✅ Express-session configurado com cookies httpOnly (7 dias de validade)
  - ✅ Validação de credenciais com bcrypt (hash de senhas)
  - ✅ UserContext refatorado para buscar usuário via API em vez de demo
  - ✅ Proteção de rotas: usuários não autenticados redirecionados para /login
  - ✅ Botão de logout no sidebar (limpa sessão e redireciona para login)
  - ✅ Estados de loading e erro bem definidos
  - ✅ Usuário admin criado automaticamente (username: admin, password: admin123)
  - ✅ Testado end-to-end: login, navegação, logout, proteção de rotas
  - ⚠️ **IMPORTANTE**: Trocar senha do admin após primeiro acesso!
- ⚠️ **Limitação API Dapic**: Não há granularidade por vendedor individual, então vendedores veem totais da sua loja (não apenas suas vendas pessoais)

### Próximos Passos
- Adicionar middleware de autorização nos endpoints de gestão de usuários
- Melhorias no Chat: iniciar nova conversa
- Conectar Calendário, Avisos e Mensagens Anônimas ao PostgreSQL
- Implementar sistema de notificações em tempo real
- Busca de dados de funcionários via CPF no Dapic
- Adicionar recuperação de senha

## Como Executar
1. Variáveis de ambiente já configuradas (DATABASE_URL, DAPIC_EMPRESA, DAPIC_TOKEN_INTEGRACAO, SESSION_SECRET)
2. Workflow "Start application" já está rodando (`npm run dev`)
3. Acesso: http://localhost:5000
4. **Login**: Use `admin` / `admin123` para primeiro acesso (trocar senha depois!)

## Notas Técnicas
- Frontend e backend servidos na mesma porta (5000) via Vite proxy
- WebSocket usa mesma porta do HTTP server
- React Query com cache automático de dados do Dapic
- Autenticação via express-session com cookies httpOnly (credentials: include)
- Usuário admin criado automaticamente no primeiro boot (hash bcrypt)
- Mensagens anônimas: funcionários enviam sem revelar identidade, mas admin vê userId do remetente no banco
