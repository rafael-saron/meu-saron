# Design Guidelines - Saron Intranet

## Design Approach

**System-Based Design** using Material Design principles adapted for enterprise productivity, with influences from modern SaaS dashboards (Linear's typography clarity, Notion's information hierarchy). This data-heavy application prioritizes information density, quick scanning, and efficient workflows.

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) - UI elements, data tables, body text
- Display: Poppins (Google Fonts) - Headers, section titles

**Hierarchy**:
- Page Titles: Poppins, 2xl (32px), Semibold
- Section Headers: Poppins, xl (24px), Semibold  
- Card Titles: Inter, lg (18px), Medium
- Body/Data: Inter, base (16px), Regular
- Captions/Metadata: Inter, sm (14px), Regular
- Small Labels: Inter, xs (12px), Medium

## Layout & Spacing System

**Tailwind Units**: Consistent use of 4, 6, 8, 12, 16 for spacing (p-4, gap-6, mb-8, py-12, px-16)

**Grid Structure**:
- Sidebar Navigation: 64px (collapsed) / 256px (expanded)
- Main Content: Container max-w-7xl with px-6 lg:px-8
- Dashboard Widgets: Grid 1/2/3 columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Data Tables: Full width within container

**Vertical Rhythm**: Section spacing py-8, card padding p-6, tight groups gap-4

## Core Components

### Navigation & Layout
- **Sidebar**: Fixed left navigation with logo at top, collapsible icon menu, user profile at bottom
- **Top Bar**: Breadcrumbs, multi-store selector dropdown, notifications bell, user avatar menu
- **Store Selector**: Prominent dropdown allowing "All Stores" or individual store filtering

### Dashboard Widgets
- **Metric Cards**: Compact stat cards with large number, label, trend indicator (↑↓), sparkline chart
- **Chart Cards**: Elevated cards (shadow-md) with header (title + period selector) and chart area
- **Table Cards**: Headers with search/filter, striped rows, pagination at bottom
- **Activity Feed**: Timeline-style list with timestamps, avatars, action descriptions

### Data Display
- **Tables**: Zebra striping, sortable headers with icons, row hover states, compact spacing (py-3 px-4)
- **Charts**: Use Chart.js - line charts for trends, bar charts for comparisons, donut charts for distributions
- **Status Badges**: Rounded-full pills with distinct styling (success, warning, error, neutral)
- **Empty States**: Centered icon + message for no data

### Communication Components
- **Chat Interface**: 
  - Left sidebar: Conversation list with avatars, last message preview, unread badges
  - Main area: Messages thread with sender avatars, timestamps, message bubbles
  - Bottom: Input with attachment icon, emoji picker, send button
  - WhatsApp-inspired: Right-aligned sent messages, left-aligned received
  
- **Announcement Board**: 
  - Featured announcements at top with larger cards
  - List view below with date, author, priority indicator
  - Modal for full announcement detail

- **Anonymous Messages**:
  - Simple form for users with textarea and submit
  - Admin view: Table showing message + revealed sender in locked column

### Calendar Component
- **Month View**: Grid layout with day cells showing shift badges (Normal/Extra)
- **Week View**: Timeline with user rows, shift blocks as colored bars
- **Legend**: Shift type indicators and employee names

### Forms & Inputs
- **Input Fields**: Border focus ring, label above, helper text below
- **Dropdowns**: Custom styled select with chevron icon
- **Buttons**: Primary (filled), Secondary (outlined), Text (ghost) variants
- **Action Buttons**: Icon + label combinations for common actions

## Component Hierarchy

### Dashboard Layout Priority
1. **Top Metrics Row**: 4 key KPI cards (sales, clients, products, receivables)
2. **Charts Section**: 2-column grid with sales trends + top products
3. **Recent Activity**: Combined feed of sales, stock movements, system events
4. **Quick Actions**: Context-aware action buttons

### Role-Based Dashboard Variations
- **Admin**: Full metrics, all modules, user management
- **Manager**: Sales, inventory, team performance, approvals
- **Sales**: Personal sales, client list, product catalog, commission
- **Finance**: Receivables, payables, cash flow, expense tracking

## Interaction Patterns

**Real-Time Updates**: Subtle badge pulse on new notifications, auto-refresh indicators on charts (small spinner icon)

**Navigation**: Breadcrumb trail at top, active sidebar item highlighted, smooth transitions between views

**Loading States**: Skeleton screens for initial load, spinners for actions, progress bars for uploads

**Notifications**: Toast messages bottom-right for success/error actions, persistent notification center in top bar

**Multi-Store Filtering**: Global selector that persists across navigation, clear indicator when filtered to single store

## Images & Visual Assets

**Icons**: Heroicons (outline for navigation, solid for actions)

**Avatars**: Circular user photos, fallback to initials with generated background

**Logo Integration**: Saron logo in sidebar header, favicon, loading screens

**Charts**: Utilize the purple/magenta tones from Saron logo as primary chart colors with complementary accent colors

**Empty States**: Simple line illustrations for empty data scenarios

## Accessibility & Responsiveness

- Mobile: Single column stacked layout, collapsible sidebar becomes drawer, tables scroll horizontally
- Tablet: 2-column grids, sidebar always visible
- Desktop: Full 3-column grids, expanded sidebar default
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- Semantic HTML throughout (nav, main, aside, section)