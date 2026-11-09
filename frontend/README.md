# ⚛️ CNMS Frontend

React + Redux TypeScript frontend for the College Newsletter Management System.

## 📋 Quick Links

- **Parent Project**: [CNMS_PROJECT README](../README.md)
- **Phase-wise Plan**: [CNMS_PHASEWISE_PLAN.md](../CNMS_PHASEWISE_PLAN.md)
- **Implementation Details**: [CNMS_Implementation_Plan.md](../CNMS_Implementation_Plan.md)

## 🗂️ Folder Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Navbar, Sidebar, Footer, etc.
│   │   ├── auth/            # Login, Register, 2FA
│   │   ├── events/          # Event submission, list, detail
│   │   ├── dashboards/      # Admin, Coordinator, Analytics
│   │   ├── admin/           # User management, Templates
│   │   ├── newsletter/      # Template builder, Preview
│   │   ├── search/          # Advanced search UI
│   │   ├── export/          # Export modal, Reports
│   │   └── shared/          # Reusable UI (Modal, Button, etc.)
│   │
│   ├── pages/               # Page-level components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API client services
│   ├── store/               # Redux slices
│   ├── utils/               # Helpers, formatters, validators
│   ├── styles/              # Global CSS
│   ├── layouts/             # App layouts
│   ├── tests/               # Component tests
│   ├── App.jsx              # Root component
│   └── main.jsx             # Entry point
│
├── public/                  # Static assets
├── dist/                    # Build output
├── .env.example             # Environment template
├── .eslintrc.json           # ESLint config
├── .prettierrc              # Prettier config
├── vite.config.js           # Vite build config
├── tailwind.config.js       # Tailwind CSS config
├── package.json             # Dependencies
├── vitest.config.js         # Test config
└── README.md                # This file
```

## 🚀 Getting Started

### Install Dependencies

```bash
npm install
```

### Setup Environment

```bash
cp .env.example .env
# Edit .env with your API URL
```

### Start Development Server

```bash
npm run dev
```

App runs on `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output in `dist/`

## 📝 Key Files Explained

### `components/` - Reusable Components

- **common/**: Navbar, Sidebar, Footer (used on every page)
- **auth/**: Login form, Register form, 2FA setup
- **events/**: Event submission form, event list, event card, calendar
- **dashboards/**: Admin dashboard, Analytics dashboard, Dean view
- **admin/**: User management table, Template editor, Format builder
- **newsletter/**: Template builder (drag-drop), Newsletter preview, Archive view
- **search/**: Search bar, Advanced filters, Search results
- **export/**: Export modal, Report generator
- **shared/**: Modal, Button, Card, Input, Table (basic UI components)

### `pages/` - Full Pages

- HomePage.jsx
- DashboardPage.jsx
- EventsPage.jsx
- AdminPage.jsx
- NewsletterPage.jsx
- AnalyticsPage.jsx
- NotFoundPage.jsx

### `hooks/` - Custom Hooks

```javascript
useAuth()              // Current user, login, logout
useApi()               // API calls with loading/error
useLocalStorage()      // Persist data in localStorage
usePagination()        // Pagination logic
useNotification()      // Toast notifications
useForm()              // Form handling
useWebSocket()         // Real-time notifications
useSearch()            // Search state management
useAnalytics()         // Analytics data fetching
```

### `services/` - API Communication

```javascript
api.js                 // Axios instance
authService.js         // Login, register, password reset
eventService.js        // Event CRUD, approval
userService.js         // User profile, preferences
newsletterService.js   // Newsletter generation, publishing
searchService.js       // Search API calls
analyticsService.js    // Metrics, dashboard data
exportService.js       // Export, reporting
websocketService.js    // Real-time notifications
```

### `store/` - Redux State Management

```javascript
authSlice.js           // User auth state
eventSlice.js          // Events list, filters
notificationSlice.js   // Notifications
uiSlice.js             // UI state (modals, etc.)
searchSlice.js         // Search state
analyticsSlice.js      // Analytics data
store.js               // Redux store config
```

## 🎨 Styling

### Tailwind CSS

All components use Tailwind CSS utility classes:

```jsx
<div className="bg-blue-500 text-white rounded-lg p-4">
  Hello World
</div>
```

### Theme Colors

```javascript
// tailwind.config.js
colors: {
  primary: '#0066cc',
  secondary: '#ff6600',
  success: '#00cc66',
  error: '#ff0000',
  warning: '#ffcc00',
}
```

### Custom Components

Use Shadcn/ui for complex components:
- Button, Input, Select
- Dialog, Dropdown, Tooltip
- Form, Tabs, Table
- And more...

## 🧪 Testing

### Component Tests

```bash
npm run test
```

Uses Vitest + React Testing Library

### Test Coverage

```bash
npm run test:coverage
```

Aim for 80%+ coverage

## 🔒 Environment Variables

```
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=CNMS
VITE_LOG_LEVEL=debug
```

## 📚 Component Examples

### Simple Component

```jsx
// src/components/common/Button.jsx
export function Button({ children, onClick, variant = 'primary' }) {
  const styles = {
    primary: 'bg-blue-500 hover:bg-blue-600',
    secondary: 'bg-gray-500 hover:bg-gray-600',
  };
  
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-white rounded ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
```

### Component with Hook

```jsx
// src/components/events/EventList.jsx
import { useApi } from '../../hooks/useApi';
import { eventService } from '../../services/eventService';

export function EventList() {
  const { request, loading, error } = useApi();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const data = await request({
        method: 'GET',
        url: '/api/events'
      });
      setEvents(data.events);
    };
    fetchEvents();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {events.map(event => (
        <EventCard key={event._id} event={event} />
      ))}
    </div>
  );
}
```

## 🔄 Development Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/event-list
   ```

2. **Create component**:
   ```
   src/components/events/EventList.jsx
   ```

3. **Create tests**:
   ```
   src/components/events/__tests__/EventList.test.jsx
   ```

4. **Run tests**:
   ```bash
   npm run test
   ```

5. **Commit & push**:
   ```bash
   git commit -m "feat: Add event list component"
   ```

## 🚨 Common Issues

### Port 5173 Already in Use

```bash
npm run dev -- --port 5174
```

### API Connection Error

- Check `VITE_API_URL` in .env
- Verify backend is running
- Check browser console for CORS errors

### Build Fails

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Tests Failing

```bash
npm run test -- --watch
# Then debug individual test
```

## 📦 Dependencies

Key packages:
- **react**: UI library
- **react-router**: Routing
- **redux**: State management
- **axios**: HTTP client
- **react-hook-form**: Form handling
- **tailwindcss**: Styling
- **recharts**: Charts
- **react-beautiful-dnd**: Drag-drop
- **socket.io-client**: Real-time
- **vitest**: Testing

See `package.json` for complete list.

## 🚀 Next Steps

1. **Phase 1 (Weeks 1-4)**:
   - Week 1-2: Newsletter UI
   - Week 3: Template builder
   - Week 4: Notification center
   - See [CNMS_PHASEWISE_PLAN.md](../CNMS_PHASEWISE_PLAN.md)

2. **Before coding**:
   - Review [CNMS_Implementation_Plan.md](../CNMS_Implementation_Plan.md)
   - Understand component hierarchy
   - Plan state management

3. **Start with**:
   - Create pages
   - Create components
   - Write tests
   - Integrate with Redux

---

**Last Updated**: June 2026  
**Maintained by**: Frontend Team
