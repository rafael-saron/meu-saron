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
- **Logo**: The Saron logo is displayed on the login screen and sidebar, with automatic white/inverted version in dark mode using CSS filters (`dark:invert dark:brightness-0 dark:contrast-200`).
- **Fonts**: Inter for body text, Poppins for titles, and Pacifico (handwriting-style) for "Meu Saron" branding on login screen.
- **Dark Mode**: Full support with a toggle, including logo inversion for visibility.
- **Components**: Shadcn/UI is used extensively, with custom color theming applied via `index.css`.
- **Dashboard Optimization**: Features an optimized dashboard with a tabbed architecture for on-demand data loading (Resumo, Análises, Dados Completos) to improve performance.
  - **Data Time Windows**: "Resumo" tab shows last 30 days only; "Análises" and "Dados Completos" tabs show all historical data (since 2020).

**Technical Implementations & Feature Specifications:**
- **Database Schema**: Includes `users` (with roles: administrador, gerente, vendedor, financeiro), `chatMessages`, `scheduleEvents`, `announcements`, and `anonymousMessages`.
- **Authentication**: Complete JWT-based authentication via `express-session` with httpOnly cookies. Role-based access control (RBAC) is implemented for different user types.
- **Multi-store Support**: Seamless integration with multiple Saron stores (Saron 1, 2, 3) via the Dapic API, with dynamic store selection and consolidated views.
- **Real-time Chat**: WhatsApp-style chat with unread message counts and real-time updates via WebSockets.
- **Anonymous Messaging**: Allows employees to send anonymous messages, with administrators retaining visibility of the sender's identity.
- **User Management**: Comprehensive CRUD operations for users, including profile picture uploads, password resets by admins, and soft deletion.
- **User Profile Page**: Complete profile management at `/perfil` with:
  - Shadcn Form + useForm + zod validation for all forms
  - Avatar upload with per-user directory isolation (`/uploads/avatars/{userId}/`)
  - Password change with current password verification
  - Session-based authorization (users can only edit their own profiles)
  - Form reset after successful updates to prevent stale dirty state
  - All inputs have data-testid attributes for testing
- **Data Normalization**: Robust currency normalization for Dapic data to handle various input formats.

**System Design Choices:**
- Frontend and backend are served on the same port (5000) using a Vite proxy.
- WebSocket communication shares the same port as the HTTP server.
- React Query is used for automatic data caching and invalidation, optimizing API calls.
- Automatic admin user creation on first boot (`admin`/`admin123`).
- Role scoping ensures data visibility is restricted based on user roles and assigned stores.

**Known Performance Considerations:**
- **Consolidated Data Loading**: When viewing "Todas as Lojas", the `/api/dapic/todas/vendaspdv` endpoint fetches data from all three stores in parallel with pagination (up to 50 pages per store = 30,000 records total). This can take 2+ minutes to complete.
- **Chart Rendering Behavior**: Charts in the "Análises" tab may show loading placeholders while consolidated data is being fetched. Individual store views (Saron 1, 2, or 3) load significantly faster.
- **API Response Format**: All consolidated endpoints (`/api/dapic/todas/*`) return `{ data: { [storeId]: data }, errors: { [storeId]: error } }` format for consistency.
- **Shared Data Optimization**: Clients (16,933 total) and products (1,001 total) are shared across all Dapic stores. When requesting `storeId='todas'`, the system:
  - Fetches complete dataset from one canonical store (with sequential fallback if primary fails)
  - Forces full auto-pagination (ignores any Pagina param to ensure all records are fetched)
  - Replicates the canonical data to all store keys to maintain response contract
  - Preserves errors from failed stores for monitoring and debugging
  - Avoids redundant API calls while maintaining per-store response structure
- **Pagination Limits**: Auto-pagination enforced with safety limits to prevent excessive API calls:
  - Clientes: 20 pages × 200 records = 4,000 max
  - Produtos: 5 pages × 200 records = 1,000 max (covers all 1,001 products)
  - VendasPDV: 10 pages × 200 records = 2,000 max per store
- **Optimized Data Loading**: Dashboard uses tab-based conditional data fetching:
  - "Resumo" tab: Only loads sales data from last 30 days (fastest)
  - "Análises" tab: Loads all historical sales data for comprehensive charts
  - "Dados Completos" tab: Loads all data (clients, products, bills, historical sales) - slowest but most complete
  - This approach reduces initial page load time and API calls
- **Products Page**: 
  - Shared data across all stores (no duplicate products)
  - Sort by name OR code with A-Z/Z-A toggle
  - Pagination: 100 products per page
- **Sales Page (Vendas PDV)**: 
  - Shows last 30 days of sales per store
  - Displays total sales, quantity, and average ticket metrics
  - Pagination: 50 sales per page
  - Search by customer, code, or salesperson

## External Dependencies
- **Dapic ERP API**:
    - **Base URL**: `https://api.dapic.com.br`
    - **Authentication**: Bearer Token JWT with automatic renewal.
    - **Rate Limit**: 100 requests/minute per endpoint.
    - **Integrated Endpoints**:
        - `/autenticacao/v1/login`
        - `/v1/clientes`
        - `/v1/orcamentos` (for quotations)
        - `/v1/produtos`
        - `/v1/vendaspdv` (for finalized POS sales, discovered after initial limitations)
    - **Credentials**: `DAPIC_EMPRESA` and `DAPIC_TOKEN_INTEGRACAO` (environment secrets).
- **PostgreSQL Database**: Utilized through Neon, accessed via Drizzle ORM.
- **Axios**: For HTTP client requests.
- **bcrypt**: For password hashing.
- **Zod**: For schema validation.