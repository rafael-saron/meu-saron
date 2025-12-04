# Meu Saron

## Overview
The Saron Intranet Management System is a comprehensive solution for the Saron clothing store, integrating seamlessly with the Dapic ERP. It provides real-time executive dashboards, multi-store data visualization, scheduling, corporate announcements, a real-time WhatsApp-style chat, and an anonymous messaging system. The business vision is to centralize operations, enhance communication, and provide actionable insights for better decision-making across all Saron stores, boosting efficiency and market responsiveness.

## User Preferences
I prefer clear and concise communication.
I want iterative development with frequent updates on progress.
Ask before making major architectural changes or decisions.
Ensure the codebase is well-documented and easy to understand.
I prefer a clean, modern UI/UX with attention to detail.

## System Architecture
The system is built with a modern stack:
- **Frontend**: React, TypeScript, Vite, Wouter for routing, TailwindCSS for styling, and Shadcn/UI for UI components.
- **Backend**: Node.js with Express, leveraging WebSockets for real-time communication.
- **Database**: PostgreSQL (Neon) managed with Drizzle ORM.
- **Real-time**: WebSockets for chat and notifications.
- **State Management**: React Query for data caching and synchronization.

**UI/UX Decisions:**
- **Color Scheme**: Primary colors are medium green (HSL 142° 55% 45%) along with white, black, and green accents.
- **Logo**: Saron logo displayed on login and sidebar, with automatic white/inverted in dark mode.
- **Fonts**: Inter for body text, Poppins for titles and "Meu Saron" branding.
- **Dark Mode**: Full support with a toggle, including logo inversion.
- **Components**: Shadcn/UI extensively used, with custom color theming.
- **Dashboard Optimization**: Tabbed architecture for on-demand data loading ("Resumo" for last 30 days, "Análises" and "Dados Completos" for historical data), custom date filters with debouncing, and ISO date validation.
- **Sales Summary Cards**: "Vendas Hoje/Semana/Mês" cards use `/api/sales/summary` endpoint (local database) for accurate data that matches goal progress values.

**Technical Implementations & Feature Specifications:**
- **Database Schema**: Includes `users` (with roles), `chatMessages`, `scheduleEvents`, `announcements`, `anonymousMessages`, `salesGoals`, and `userStores` (junction table).
- **Authentication**: JWT-based with `express-session`, httpOnly cookies, and role-based access control (RBAC).
- **Multi-store Support**: Seamless integration with Saron 1, 2, 3 via Dapic API for dynamic store selection and consolidated views.
- **Real-time Chat**: WhatsApp-style chat with unread counts via WebSockets.
- **Anonymous Messaging**: Employees can send anonymous messages, with admin visibility.
- **User Management**: CRUD for users, profile picture uploads, admin password resets, and soft deletion.
- **User Profile Page**: Complete profile management with Shadcn Form, Zod validation, avatar uploads, password changes, and session-based authorization.
- **Local Sales Storage System**:
    - **Database Schema**: `sales` and `saleItems` tables with one-to-many relationship.
    - **Automatic Synchronization**: Monthly cron job and on-demand full history sync from Dapic using a DELETE-then-INSERT refresh strategy.
    - **Error Isolation**: Per-store sync with independent error handling.
    - **Pagination Strategy**: dapicService.getVendasPDV returns single page when `Pagina` param provided (caller controls iteration), otherwise auto-paginates with configurable `maxPages` limit. salesSyncService controls page iteration with maxPages=100 for historical sync.
    - **Historical Data**: Successfully synced ~7,775 sales from 2024 (Jun-Dec) for year-over-year comparison.
    - **API Endpoints**: For manual sync, full sync, status checks, and querying local sales.
- **Role-Based Menu Access Control**: Granular menu access based on user roles (Vendedores, Gerentes, Administradores, Financeiro).
- **Sales Goals Management (`/metas`)**:
    - **Goal Types**: Individual (seller/manager) or Team/Conjunta (store-wide).
    - **Period Support**: Weekly or Monthly tracking with date ranges.
    - **Progress Visualization**: Real-time cards with color-coded indicators based on local sales data.
    - **Access Control**: Admin and Manager roles can create/modify goals.
    - **Auto-refresh**: Progress updates every 60 seconds.
- **Dashboard Goal Progress Bars (`/api/goals/dashboard`)**:
    - Displays goals relevant to the current period.
    - Role-specific display: individual goals for sellers, aggregated for managers/admins.
    - Calculates "on-track" status based on actual vs. expected percentage.
    - Auto-refreshes every 60 seconds.
- **Weekly Bonus Payment Summary (`/pagamento-bonus`)**:
    - **Purpose**: Financial panel for Monday bonus payments (for previous work week).
    - **Access Control**: Restricted to 'administrador' and 'financeiro' roles only.
    - **API Endpoint**: `/api/bonus/payment-summary` returns previous week's bonuses.
    - **Features**: Summary cards by role (vendors, managers, cashiers), breakdown by store, detailed individual tables with goal achievement status.
    - **Date Calculation**: Uses São Paulo timezone (UTC-3), calculates previous week (Mon-Sun).
    - **Auto-refresh**: Updates every 60 seconds.
- **Multi-Store Manager Support**: Backend APIs for assigning multiple stores to managers via `userStores` junction table.
- **Data Normalization**: Robust currency normalization for Dapic data.
- **Financial Daily Revenue (`/financeiro/receita-diaria`)**:
    - **Purpose**: Day-by-day revenue comparison across multiple years.
    - **Access Control**: Restricted to 'administrador' and 'financeiro' roles only.
    - **API Endpoint**: `/api/financial/daily-revenue` with month/year/storeId/compareYears filters.
    - **Features**: Area chart visualization, detailed daily table with deltas, total comparison cards.
    - **Data Source**: Uses local `sales` table for consistent data across all views.
    - **Comparison**: Select multiple years for year-over-year analysis with percentage changes.
    - **Auto-refresh**: Updates every 60 seconds.

**System Design Choices:**
- Frontend and backend share port 5000 via Vite proxy.
- WebSocket communication on the same port as HTTP.
- React Query for data caching and invalidation.
- Automatic admin user creation on first boot.
- Role scoping restricts data visibility based on user roles and assigned stores.
- **Consolidated Data Loading**: "Todas as Lojas" view loads data from all three stores in parallel, with pagination up to 30,000 records.
- **Chart Rendering**: "Análises" tab charts show loading placeholders during consolidated data fetching.
- **API Response Format**: Consolidated endpoints return `{ data: { [storeId]: data }, errors: { [storeId]: error } }`.
- **Shared Data Optimization**: Clients and products are fetched from one canonical store to avoid redundant API calls when requesting `storeId='todas'`.
- **Pagination Limits**: Safety limits applied to auto-pagination for clients (4,000 max), products (1,000 max), and sales (2,000 max per store).
- **Optimized Data Loading**: Dashboard uses tab-based conditional data fetching to reduce initial load times.
- **Products Page**: Shared data, sortable, 100 products per page.
- **Clients Page**: Unified database, search by name/document, 100 clients per page.
- **Sales Page (Vendas PDV)**: Default "Todas as Lojas" view, 30 days default, customizable date filters, displays metrics and a detailed table with robust field fallbacks and pagination.

## External Dependencies
- **Dapic ERP API**:
    - **Base URL**: `https://api.dapic.com.br`
    - **Authentication**: Bearer Token JWT with automatic renewal.
    - **Rate Limit**: 100 requests/minute per endpoint.
    - **Integrated Endpoints**: `/autenticacao/v1/login`, `/v1/clientes`, `/v1/orcamentos`, `/v1/produtos`, `/v1/vendaspdv`, `/v1/contaspagar`.
    - **Credentials**: `DAPIC_EMPRESA` and `DAPIC_TOKEN_INTEGRACAO` (environment secrets).
- **PostgreSQL Database**: Utilized through Neon, accessed via Drizzle ORM.
- **Axios**: For HTTP client requests.
- **bcrypt**: For password hashing.
- **Zod**: For schema validation.