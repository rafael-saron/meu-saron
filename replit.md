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
- **Logo**: The Saron logo is displayed on the login screen.
- **Fonts**: Inter for body text and Poppins for titles.
- **Dark Mode**: Full support with a toggle.
- **Components**: Shadcn/UI is used extensively, with custom color theming applied via `index.css`.
- **Dashboard Optimization**: Features an optimized dashboard with a tabbed architecture for on-demand data loading (Resumo, Análises, Dados Completos) to improve performance.

**Technical Implementations & Feature Specifications:**
- **Database Schema**: Includes `users` (with roles: administrador, gerente, vendedor, financeiro), `chatMessages`, `scheduleEvents`, `announcements`, and `anonymousMessages`.
- **Authentication**: Complete JWT-based authentication via `express-session` with httpOnly cookies. Role-based access control (RBAC) is implemented for different user types.
- **Multi-store Support**: Seamless integration with multiple Saron stores (Saron 1, 2, 3) via the Dapic API, with dynamic store selection and consolidated views.
- **Real-time Chat**: WhatsApp-style chat with unread message counts and real-time updates via WebSockets.
- **Anonymous Messaging**: Allows employees to send anonymous messages, with administrators retaining visibility of the sender's identity.
- **User Management**: Comprehensive CRUD operations for users, including profile picture uploads, password resets by admins, and soft deletion.
- **Data Normalization**: Robust currency normalization for Dapic data to handle various input formats.

**System Design Choices:**
- Frontend and backend are served on the same port (5000) using a Vite proxy.
- WebSocket communication shares the same port as the HTTP server.
- React Query is used for automatic data caching and invalidation, optimizing API calls.
- Automatic admin user creation on first boot (`admin`/`admin123`).
- Role scoping ensures data visibility is restricted based on user roles and assigned stores.

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