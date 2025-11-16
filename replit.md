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

#### ⚠️ **LIMITAÇÃO CRÍTICA - Vendas do PDV**
**Problema identificado em 14 Nov 2025**: A API Dapic atualmente **NÃO fornece vendas finalizadas do PDV**. O endpoint `/v1/orcamentos` retorna apenas orçamentos/cotações (Status="Aberto"), não as vendas diárias que aparecem nos relatórios do Dapic.

**Impacto**: 
- Dashboard mostra R$ 0,00 em vendas mesmo com vendas reais no PDV
- Relatórios PDF do Dapic mostram vendas (ex: R$ 7.803,14 em 13/11/2025), mas esses dados não aparecem na API
- Cards "Vendas Hoje", "Vendas Semana", "Vendas Mês" ficam zerados

**Testes realizados em 16 Nov 2025**:
Foram testados 12 endpoints diferentes para encontrar vendas do PDV:
- ❌ `/v1/vendas` - 404 Not Found
- ❌ `/v1/vendas-pdv` - 404 Not Found
- ❌ `/v1/nfe` - 404 Not Found
- ❌ `/v1/pedidos` - 404 Not Found
- ❌ `/v1/movimentos` - 404 Not Found
- ❌ `/v1/caixas` - 404 Not Found
- ❌ `/v1/caixa` - 404 Not Found
- ❌ `/v1/fiscal/vendas` - 404 Not Found
- ❌ `/v1/fiscal/nfe` - 404 Not Found
- ❌ `/v1/notas-fiscais` - 404 Not Found
- ❌ `/v1/financeiro/vendas` - 404 Not Found
- ✅ `/v1/orcamentos?Status=Fechado` - Retorna vazio (confirma que vendas não aparecem como orçamentos fechados)

**Conclusão**: Nenhum dos endpoints testados retorna vendas finalizadas do PDV. Ver detalhes em `RESULTADO_TESTE_ENDPOINTS_DAPIC.md`

**Solução necessária**:
1. Entrar em contato com **suporte WebPic/Dapic** (https://www.webpic.com.br)
2. Solicitar documentação de endpoint para **vendas finalizadas do PDV**
3. Mencionar que já foram testados 12 endpoints sem sucesso (fortalece o pedido)
4. Após receber a documentação, integrar o novo endpoint em `server/dapic.ts` e `server/routes.ts`

**Documentos de referência**:
- `GUIA_DAPIC_VENDAS_PDV.md` - Guia passo a passo para contatar o suporte
- `RESULTADO_TESTE_ENDPOINTS_DAPIC.md` - Evidência técnica dos testes realizados

**Workaround temporário**: Aviso permanente no dashboard explicando a limitação

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
- ✅ **Documentação da Limitação API Dapic - Vendas PDV**:
  - Aviso permanente no dashboard explicando que `/v1/orcamentos` retorna apenas cotações
  - Seção expansível com instruções para contatar suporte Dapic
  - Guia completo criado (GUIA_DAPIC_VENDAS_PDV.md) com passo a passo para solicitar endpoint de vendas
  - Data-testids adicionados para testes automatizados (alert-dapic-limitation, button-expand-dapic-solution, link-webpic-support)
  - Limitação documentada no replit.md com impacto e solução
  - ✅ Testado com e2e: aviso visível, detalhes expansíveis, link para suporte funcionando
- ⚠️ **Nota de Segurança**: Sistema atual usa usuário demo sem autenticação real. Endpoints de gestão de usuários preparados para autenticação futura mas não implementam autorização no momento.
- ⚠️ **Limitação API Dapic**: Não há granularidade por vendedor individual, então vendedores veem totais da sua loja (não apenas suas vendas pessoais)

### Próximos Passos
- Implementar autenticação real (login/logout) substituindo usuário demo
- Adicionar middleware de autorização nos endpoints de gestão de usuários
- Melhorias no Chat: iniciar nova conversa, contador de mensagens não lidas
- Conectar Calendário, Avisos e Mensagens Anônimas ao PostgreSQL
- Implementar sistema de notificações em tempo real
- Busca de dados de funcionários via CPF no Dapic

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
