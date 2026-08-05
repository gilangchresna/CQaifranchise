# CyberQuote Dashboard — UI/UX Implementation Plan

**Version:** 1.0  
**Date:** July 23, 2026  
**Author:** Frontend Engineering Team  
**Status:** Draft for Review

---

## 1. Executive Summary

This plan outlines the frontend implementation strategy for the CyberQuote AI Big Data Framework's Experience & Consumption Layer (Layer 6). The existing MVP already demonstrates solid React + Vite + Tailwind v4 foundations with role-based views and real-time monitoring capabilities. This plan extends and formalizes the design system, interaction patterns, and implementation roadmap.

### Current State Assessment

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| **Framework** | React 19 + Vite 6 | React 19 + Vite 6 (stable) |
| **Styling** | Tailwind v4 | Tailwind v4 with design tokens |
| **Charts** | Recharts | Recharts + dedicated chart library |
| **Role Views** | 3 roles (HQ/Regional/Franchisee) | 3 roles with distinct UX per role |
| **Navigation** | Single sidebar | Adaptive navigation by role |
| **AI Chat** | ChatPanel (Athena) | Enhanced copilot with context awareness |
| **Mobile** | Responsive fallback | Dedicated mobile-first experience |
| **State** | Local state + Supabase | XState for complex flows |

---

## 2. Design System

### 2.1 Brand Foundation

Based on the CyberQuote visual identity from existing code:

```
Primary:      #2563EB (Blue 600)
Secondary:    #7C3AED (Violet 600)
Accent:       #10B981 (Emerald 500)
Warning:      #F59E0B (Amber 500)
Danger:       #EF4444 (Red 500)

Background:   #F8FAFC (Slate 50)
Surface:      #FFFFFF (White)
Border:       #E2E8F0 (Slate 200)
Text Primary: #0F172A (Slate 900)
Text Muted:   #64748B (Slate 500)
```

### 2.2 Typography Scale

```css
--font-size-xs:    0.75rem  /* 12px - Labels, timestamps */
--font-size-sm:    0.875rem  /* 14px - Body text, descriptions */
--font-size-base:  1rem      /* 16px - Default text */
--font-size-lg:    1.125rem  /* 18px - Section headers */
--font-size-xl:    1.25rem   /* 20px - Card titles */
--font-size-2xl:   1.5rem    /* 24px - Page headers */
--font-size-3xl:   1.875rem  /* 30px - Hero metrics */

/* Font weights */
--font-normal:     400
--font-medium:     500
--font-semibold:   600
--font-bold:       700
```

### 2.3 Spacing System

```css
--space-1:   4px   /* Tight gaps */
--space-2:   8px   /* Internal padding */
--space-3:   12px  /* Card padding */
--space-4:   16px  /* Section gaps */
--space-5:   20px  /* Container padding */
--space-6:   24px  /* Major sections */
--space-8:   32px  /* Page sections */
--space-12:  48px  /* Major divisions */
```

### 2.4 Component Token Examples

```css
/* Cards */
--card-radius:     0.75rem  /* 12px */
--card-shadow:     0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
--card-shadow-hover: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
--card-padding:    1.25rem

/* Buttons */
--btn-radius:      0.5rem   /* 8px */
--btn-padding-x:   1rem
--btn-padding-y:   0.5rem
--btn-height-sm:   2rem     /* 32px */
--btn-height-md:   2.5rem   /* 40px */
--btn-height-lg:   3rem      /* 48px */

/* Inputs */
--input-radius:    0.5rem
--input-height:    2.5rem
--input-border:    1px solid var(--color-border)
--input-focus:     2px ring in primary color */
```

---

## 3. Navigation Architecture

### 3.1 Role-Based Navigation

**HQ Role — Global Operations View**
```
┌─────────────────────────────────────────────────────┐
│ CyberQuote Platform                          🔔 👤 │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐                                    │
│ │ Dashboard   │  ← Global Network Health           │
│ ├─────────────┤                                    │
│ │ Outlets     │  ← Network Directory              │
│ ├─────────────┤                                    │
│ │ Workforce   │  ← Global Staff Management        │
│ ├─────────────┤                                    │
│ │ Workflows   │  ← Enterprise Workflows           │
│ ├─────────────┤                                    │
│ │ Agents      │  ← Agent Orchestration            │
│ ├─────────────┤                                    │
│ │ Risk        │  ← Stockout Risk Analytics        │
│ ├─────────────┤                                    │
│ │ Integrations│  ← System Integrations            │
│ ├─────────────┤                                    │
│ │ Models      │  ← ML Models Registry             │
│ ├─────────────┤                                    │
│ │ Access      │  ← Access Control                 │
│ ├─────────────┤                                    │
│ │ Settings    │  ← Platform Settings              │
│ └─────────────┘                                    │
│                                                     │
│ [Role Switcher]                                    │
│  ○ HQ (current)                                    │
│  ○ Regional                                        │
│  ○ Franchisee                                      │
└─────────────────────────────────────────────────────┘
```

**Regional Role — Area Operations View**
```
Navigation Items:
- Regional Dashboard
- Area Outlets
- Area Staff
- Active Escalations
- Agent Orchestration (view-only)
- Stockout Risk
- Area Integrations
- ML Models (view-only)
- Access Control
- Regional Settings

Scope: Filtered to assigned regions only
```

**Franchisee Role — Store Operations View**
```
Navigation Items:
- My Store (Dashboard)
- My Team (Workforce)
- My Tasks (Workflows)
- Store Settings

Scope: Single outlet context
```

### 3.2 Navigation Interaction Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Active state** | Blue-50 bg, blue-700 text, blue-600 icon | Clear current location |
| **Hover state** | Slate-100 bg, slate-900 text | Responsive feedback |
| **Keyboard nav** | Full tab/arrow key support | Accessibility |
| **Mobile collapse** | Hamburger menu → slide-out drawer | Mobile UX |
| **Breadcrumbs** | HQ > Outlets > WKN-001 | Deep navigation context |

---

## 4. Dashboard Views by Role

### 4.1 HQ Dashboard — Executive View

```
┌────────────────────────────────────────────────────────────────────────┐
│ HQ Operations Center                              🔍 Search    🔔 JD   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ 147        │ │  +5.2%     │ │  12        │ │  99.9%     │           │
│  │ Active     │ │ Sales Var  │ │ Critical   │ │ System     │           │
│  │ Outlets    │ │ vs Target  │ │ Alerts     │ │ Health     │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│                                                                        │
│  ┌─────────────────────────────────┐ ┌────────────────────────────┐  │
│  │                                 │ │  Regional Performance       │  │
│  │   Network Sales Today           │ │  ┌──────────────────────┐  │  │
│  │   ─────────────────             │ │  │ Jakarta      ████ 98% │  │  │
│  │   ▐█▌ ▐██▌  ▐██▌  ▐██▌        │ │  │ Surabaya     ███░ 82% │  │  │
│  │   08  10   12   14   16       │ │  │ Bali         ██░░ 65% │  │  │
│  │                                 │ │  └──────────────────────┘  │  │
│  │   ─ Actual   ··· Baseline      │ │                             │  │
│  └─────────────────────────────────┘ └────────────────────────────┘  │
│                                                                        │
│  ┌────────────────────────────┐ ┌────────────────────────────────┐   │
│  │  Active Alerts (12)        │ │  AI Insights Summary           │   │
│  │  ┌────────────────────────┐│ │                                │   │
│  │  │ 🔴 WKN-001: Stock risk ││ │  3 outlets trending down      │   │
│  │  │ 🟠 SAP-003: Sales drop ││ │  2 potential stockouts today   │   │
│  │  │ 🟡 MYB-002: Understaff ││ │  Peak hours: 12:00-14:00       │   │
│  │  └────────────────────────┘│ │                                │   │
│  └────────────────────────────┘ └────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Regional Dashboard — Area Manager View

```
Scope: Filtered to assigned regions
Widgets:
- Area summary stats (outlets, alerts, staff)
- Outlet performance ranking within region
- Regional alerts list (escalated items)
- Team performance metrics
- Area-specific recommendations
```

### 4.3 Franchisee Dashboard — Store Owner View

```
Scope: Single outlet context
Widgets:
- Today's sales vs target
- Stock status summary
- Staff on duty
- Active tasks/cases
- Quick actions: Create alert, View reports
- AI recommendations for my store
```

---

## 5. Component Specifications

### 5.1 StatCard Component

```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: number;        // Percentage change
  trendDirection?: 'up' | 'down' | 'neutral';
  status?: 'normal' | 'warning' | 'critical';
}
```

**States:**
- Default: White bg, subtle shadow
- Hover: Elevated shadow, slight scale (1.02)
- Loading: Skeleton pulse animation
- With trend: Green (positive) or Red (negative) indicator
- With status: Border color indicates severity

### 5.2 AlertCard Component

```tsx
interface AlertCardProps {
  id: string;
  type: 'anomaly' | 'stockout' | 'complaint' | 'staffing' | 'compliance';
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';
  title: string;
  description: string;
  outlet: { name: string; code: string };
  timestamp: Date;
  status: 'open' | 'in-progress' | 'resolved';
  aiRecommendation?: string;
  onAcknowledge?: () => void;
  onCreateCase?: () => void;
}
```

**Severity Visual System:**
| Severity | Color | Icon | Behavior |
|----------|-------|------|----------|
| P0_CRITICAL | Red-500 bg | AlertTriangle | Pulse animation, prominent |
| P1_HIGH | Orange-500 bg | AlertCircle | Standard prominence |
| P2_MEDIUM | Amber-500 bg | Info | Subdued |
| P3_LOW | Slate-400 bg | Check | Minimal |

### 5.3 OutletCard Component (from existing code)

Already implemented with:
- Animated sales counter
- Risk gradient backgrounds
- Real-time pulse indicator
- Trend badges
- Stock risk progress bar

**Enhancements needed:**
- Add skeleton loading state
- Implement keyboard navigation
- Add context menu (right-click actions)

### 5.4 DataTable Component

```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  emptyState?: ReactNode;
  loading?: boolean;
}
```

### 5.5 Chart Components

**Available Charts:**
| Chart Type | Use Case | Library |
|------------|----------|---------|
| LineChart | Sales trends, time series | Recharts (existing) |
| AreaChart | Cumulative data, stacked metrics | Recharts |
| BarChart | Category comparisons | Recharts |
| PieChart | Distribution, percentages | Recharts |
| HeatMap | Outlet/region matrix | Custom + D3 |
| GaugeChart | KPI vs target | Recharts + Custom |

**Chart Guidelines:**
- Use consistent color palette
- Include tooltips with exact values
- Responsive containers
- Empty state handling
- Loading skeleton

---

## 6. Interaction Patterns

### 6.1 Data Fetching States

```
┌─────────────────────────────────────┐
│                                     │
│         ┌───────────────┐           │
│         │   📊 Stats    │           │
│         └───────┬───────┘           │
│                 │                    │
│         ┌───────▼───────┐           │
│         │   Loading...  │  ← Spinner │
│         └───────┬───────┘           │
│                 │                    │
│         ┌───────▼───────┐           │
│         │    Error!     │  ← Red box │
│         │   [Retry]     │           │
│         └───────────────┘           │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 Role-Based Data Filtering

```tsx
// Filter data based on active role
function useRoleFilteredData(data: RawData[], role: Role) {
  switch (role) {
    case 'HQ':
      return data; // No filter
    case 'Regional':
      return data.filter(item => 
        item.regionId === currentUser.regionId
      );
    case 'Franchisee':
      return data.filter(item => 
        item.outletId === currentUser.outletId
      );
  }
}
```

### 6.3 Real-Time Updates

**Implementation Strategy:**
1. Supabase Realtime subscriptions for live data
2. Optimistic UI updates for user actions
3. Stale data indicators
4. Manual refresh option

```tsx
// Real-time subscription pattern
useEffect(() => {
  const subscription = supabase
    .channel('alerts')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'alerts'
    }, (payload) => {
      // Update local state
      setAlerts(prev => updateAlertList(prev, payload));
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

### 6.4 Form Validation Patterns

| Pattern | Implementation |
|---------|----------------|
| Required fields | Red asterisk, inline error |
| Email | Standard regex validation |
| Number ranges | Min/max constraints |
| Async validation | Debounced API call |
| Form submission | Loading state, disabled button |
| Success | Toast notification |
| Error | Inline message + summary |

---

## 7. Responsive Design Strategy

### 7.1 Breakpoint System

```css
/* Mobile-first breakpoints */
--breakpoint-sm:  640px   /* Large phones */
--breakpoint-md:  768px   /* Tablets */
--breakpoint-lg:  1024px  /* Small laptops */
--breakpoint-xl:  1280px  /* Desktops */
--breakpoint-2xl: 1536px  /* Large screens */
```

### 7.2 Layout Adaptations

| Breakpoint | Sidebar | Content | Chat |
|------------|---------|---------|------|
| < 768px | Hidden, hamburger menu | Full width | Floating button |
| 768-1024px | Collapsed icons | Flexible | Floating button |
| > 1024px | Full labels | Flexible | Inline panel |

### 7.3 Mobile Navigation Pattern

```
┌────────────────────┐
│ ☰ CyberQuote    🔔│
├────────────────────┤
│                    │
│   [Content Area]   │
│                    │
│                    │
│                    │
│                    │
├────────────────────┤
│ 🏠 │ 📊 │ ⚠️ │ 💬 │ ← Bottom nav
└────────────────────┘
```

---

## 8. AI Copilot Integration (Athena)

### 8.1 Chat Interface States

**Minimized State:**
- Floating button, bottom-right
- Pulsing indicator when new message
- Click to expand

**Expanded State:**
- 400px width panel
- Message history with scroll
- Quick action suggestions
- Input with send button

### 8.2 Conversation Patterns

```
User: "What alerts do I have?"
      ↓
Athena: "📊 You have 4 active alerts:
         - 2x Stock Risk (WKN-001, MYB-002)
         - 1x Sales Drop (SAP-003)
         - 1x Staff Absent (JKT-004)
         
         Would you like me to create cases?"
```

### 8.3 Context Awareness

Athena should have access to:
- Current user role and scope
- Active outlet context
- Recent dashboard filters
- Open alerts and cases
- User preferences

---

## 9. Accessibility Requirements

### 9.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Minimum 4.5:1 for text |
| Focus indicators | Visible focus ring on all interactive elements |
| Keyboard navigation | Full tab/arrow support |
| Screen readers | ARIA labels, roles, live regions |
| Reduced motion | Respect `prefers-reduced-motion` |
| Text scaling | Support up to 200% zoom |

### 9.2 ARIA Patterns

```tsx
// Alert component with ARIA
<div 
  role="alert" 
  aria-live="polite"
  aria-atomic="true"
>
  {alert.message}
</div>

// Data table with proper headers
<table role="grid">
  <thead>
    <tr>
      <th scope="col">Outlet</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
</table>
```

---

## 10. Performance Optimizations

### 10.1 Code Splitting

```tsx
// Lazy load route components
const Outlets = lazy(() => import('./components/Outlets'));
const Agents = lazy(() => import('./components/Agents'));
const Settings = lazy(() => import('./components/Settings'));

// Wrap in Suspense
<Suspense fallback={<PageLoader />}>
  <Outlets />
</Suspense>
```

### 10.2 Memoization Strategy

| Component | Memo Type | Trigger |
|-----------|-----------|---------|
| StatCard | React.memo | Re-renders on value change |
| AlertCard | React.memo | Props change |
| OutletCard | React.memo | Outlet data change |
| DataTable | useMemo | Data or filters change |
| Chart | React.memo | Data change |

### 10.3 Virtualization

For lists > 50 items:
- Use `react-window` or `react-virtualized`
- Virtualize outlet lists
- Virtualize alert histories
- Virtualize log streams

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Establish design tokens in Tailwind config
- [ ] Create base component library (StatCard, AlertCard, DataTable)
- [ ] Implement responsive layout shell
- [ ] Set up routing with lazy loading

### Phase 2: Core Views (Week 3-4)
- [ ] Complete Dashboard component for all roles
- [ ] Implement Outlets view with detail drill-down
- [ ] Build AlertsList with real-time updates
- [ ] Create Workflows case management view

### Phase 3: Advanced Features (Week 5-6)
- [ ] Enhance AI Copilot (Athena) with context
- [ ] Implement Agent orchestration view
- [ ] Build Risk analytics dashboard
- [ ] Add Integrations status view

### Phase 4: Polish (Week 7-8)
- [ ] Mobile optimization and testing
- [ ] Accessibility audit and fixes
- [ ] Performance optimization
- [ ] Animation and micro-interactions

---

## 12. File Structure

```
src/
├── components/
│   ├── ui/                    # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── Skeleton.tsx
│   ├── dashboard/
│   │   ├── StatCard.tsx        # (existing)
│   │   ├── ChartCard.tsx
│   │   ├── RegionMap.tsx
│   │   └── TrendIndicator.tsx
│   ├── outlets/
│   │   ├── OutletCard.tsx      # (existing)
│   │   ├── OutletGrid.tsx
│   │   ├── OutletDetail.tsx
│   │   └── TransactionModal.tsx
│   ├── alerts/
│   │   ├── AlertCard.tsx
│   │   ├── AlertList.tsx       # (existing)
│   │   └── AlertFilters.tsx
│   ├── chat/
│   │   ├── ChatPanel.tsx       # (existing - Athena)
│   │   ├── MessageBubble.tsx
│   │   └── QuickActions.tsx
│   ├── agents/
│   │   ├── AgentCard.tsx
│   │   ├── AgentGrid.tsx
│   │   ├── TaskTimeline.tsx
│   │   └── LogStream.tsx
│   └── layout/
│       ├── Layout.tsx          # (existing)
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       ├── MobileNav.tsx
│       └── Breadcrumbs.tsx
├── hooks/
│   ├── useRoleFilter.ts
│   ├── useRealtimeData.ts
│   ├── useAnimatedNumber.ts    # (existing)
│   └── useMediaQuery.ts
├── lib/
│   ├── supabase.ts             # (existing)
│   ├── utils.ts                # (existing)
│   └── cn.ts                   # (existing)
├── pages/
│   └── (use tab-based routing)
├── styles/
│   └── globals.css             # Design tokens
├── types/
│   └── index.ts                # (existing)
└── App.tsx                     # (existing)
```

---

## 13. Dependencies

### Current (Already in use)
```json
{
  "react": "^19.0.1",
  "react-dom": "^19.0.1",
  "recharts": "^3.9.1",
  "lucide-react": "^0.546.0",
  "tailwindcss": "^4.1.14",
  "@tailwindcss/vite": "^4.1.14",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.6.0",
  "@supabase/supabase-js": "^2.110.3"
}
```

### Recommended Additions
```json
{
  "zustand": "^5.0.0",           # Lightweight state management
  "@tanstack/react-query": "^5.0.0",  # Data fetching/caching
  "@tanstack/react-virtual": "^3.0.0", # List virtualization
  "sonner": "^1.4.0",            # Toast notifications
  "date-fns": "^3.0.0",          # Date formatting
  "framer-motion": "^11.0.0"     # Animations (optional)
}
```

---

## 14. Testing Strategy

### Unit Tests
- Component rendering
- State management
- Utility functions
- Hook behavior

### Integration Tests
- Role switching
- Data fetching flows
- Form submissions
- Navigation

### E2E Tests (Playwright)
- Critical user journeys
- Role-based access
- Real-time updates
- Mobile responsiveness

### Visual Regression
- Storybook + Chromatic
- Percy or reg-suit

---

## 15. Documentation Requirements

1. **Component Documentation**
   - Storybook stories for all components
   - Props API documentation
   - Usage examples

2. **Design Tokens**
   - Figma library sync
   - CSS variable reference
   - Theme customization guide

3. **Architecture Decisions**
   - ADR (Architecture Decision Records) for major choices
   - State management patterns
   - API integration patterns

---

## 16. Open Questions

1. **Offline support**: Required for field staff?
2. **PWA**: Progressive web app capabilities?
3. **Dark mode**: Theme customization?
4. **Multi-language**: i18n requirements?
5. **Animation library**: Framer Motion or CSS animations?
6. **Chart library**: Continue with Recharts or upgrade?

---

*Document Version: 1.0*  
*Next Review: TBD based on stakeholder feedback*
