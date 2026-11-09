# 🔧 CNMS Backend

Express.js + MongoDB backend for the College Newsletter Management System.

## 📋 Quick Links

- **Parent Project**: [CNMS_PROJECT README](../README.md)
- **Phase-wise Plan**: [CNMS_PHASEWISE_PLAN.md](../CNMS_PHASEWISE_PLAN.md)
- **Implementation Details**: [CNMS_Implementation_Plan.md](../CNMS_Implementation_Plan.md)

## 🗂️ Folder Structure

```
backend/
├── src/
│   ├── config/              # Database, email, auth configs
│   ├── models/              # MongoDB schemas
│   ├── routes/              # API routes
│   ├── controllers/         # Request handlers
│   ├── services/            # Business logic (newsletter, auth, email, etc.)
│   ├── middleware/          # Auth, validation, logging, RBAC
│   ├── validators/          # Input validation schemas (Joi)
│   ├── utils/               # Helpers, logger, constants
│   ├── jobs/                # Background jobs (Bull queue)
│   ├── websocket/           # Socket.io handlers
│   └── tests/
│       ├── unit/            # Service/utility tests
│       ├── integration/      # API endpoint tests
│       └── e2e/             # End-to-end tests
│
├── docs/                    # Technical documentation
├── logs/                    # Application logs
├── .env.example             # Environment template
├── .eslintrc.json           # ESLint config
├── .prettierrc              # Prettier config
├── package.json             # Dependencies
├── docker-compose.yml       # Local Docker setup
├── Dockerfile               # Production Docker image
├── jest.config.js           # Test configuration
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
# Edit .env with your configuration
```

### Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### Start with Docker

```bash
docker-compose up
```

Services:
- Backend: http://localhost:5000
- MongoDB: localhost:27017
- Redis: localhost:6379

## 📝 Key Files Explained

### `config/` - Configuration
- **database.js**: MongoDB connection
- **cloudinary.js**: File upload config
- **email.js**: SendGrid setup
- **redis.js**: Cache setup
- **environment.js**: Env variables validation

### `models/` - Data Schemas
- **User.js**: User profile, roles, permissions
- **Event.js**: Events with approval workflow
- **Newsletter.js**: Newsletters and versions
- **NewsletterTemplate.js**: Email templates
- **Notification.js**: User notifications
- **AuditLog.js**: Action tracking
- And more for comments, ratings, etc.

### `services/` - Business Logic
- **authService.js**: Login, registration, JWT
- **eventService.js**: Event CRUD + approval
- **emailService.js**: SendGrid integration
- **newsletterService.js**: Generation + scheduling
- **notificationService.js**: Multi-channel notifications
- **searchService.js**: Full-text search
- **analyticsService.js**: Metrics aggregation

### `middleware/` - Request Processing
- **authenticate.js**: JWT verification
- **authorize.js**: RBAC enforcement
- **departmentFilter.js**: Data isolation
- **errorHandler.js**: Error response formatting
- **validation.js**: Input validation
- **rateLimit.js**: Rate limiting
- **audit.js**: Action logging

### `routes/` - API Endpoints
- **auth.routes.js**: Login, register, password reset
- **event.routes.js**: CRUD + approval
- **newsletter.routes.js**: Generation + publishing
- **notification.routes.js**: Preferences + history
- **user.routes.js**: Profile management
- **admin.routes.js**: Admin operations

## 🧪 Testing

### Unit Tests (Services, Utils)

```bash
npm run test:unit
```

### Integration Tests (API Endpoints)

```bash
npm run test:integration
```

### All Tests + Coverage

```bash
npm run test:coverage
```

## 🔒 Environment Variables

See `.env.example` for all required variables:

```
# Database
MONGODB_URI=mongodb://localhost:27017/cnms

# Cache
REDIS_URL=redis://localhost:6379

# Email
SENDGRID_API_KEY=your_key
SENDER_EMAIL=noreply@college.edu

# Auth
JWT_SECRET=your_secret
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
```

## 📚 API Documentation

API endpoints follow RESTful conventions:

```
GET    /api/events              # List events
POST   /api/events              # Create event
GET    /api/events/:id          # Get event
PUT    /api/events/:id          # Update event
DELETE /api/events/:id          # Delete event
POST   /api/events/:id/approve  # Approve event
POST   /api/events/:id/reject   # Reject event

GET    /api/newsletters         # List newsletters
POST   /api/newsletters/generate # Generate newsletter
POST   /api/newsletters/:id/publish # Publish newsletter

GET    /api/users/me            # Current user profile
PUT    /api/users/me            # Update profile
POST   /api/auth/login          # User login
POST   /api/auth/register       # User registration

... and more (see routes/)
```

## 🔄 Development Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/newsletter-generation
   ```

2. **Implement feature**:
   - Add routes in `routes/`
   - Add controllers in `controllers/`
   - Add business logic in `services/`
   - Add models in `models/` if needed
   - Add validation in `validators/`
   - Add tests in `tests/`

3. **Test locally**:
   ```bash
   npm run test
   npm run dev
   ```

4. **Commit & push**:
   ```bash
   git commit -m "feat: Add newsletter generation"
   git push origin feature/newsletter-generation
   ```

5. **Create Pull Request & wait for review**

## 📊 Database Schema

Key collections in MongoDB:

- **users** - User accounts with roles
- **events** - College events
- **departments** - College departments
- **newsletters** - Generated newsletters
- **newsletter_templates** - Email templates
- **notifications** - User notifications
- **audit_logs** - Action history
- **comments** - Event comments
- **ratings** - Event ratings
- And more...

## 🔐 Security Practices

✅ **Always follow**:
- Hash passwords with bcrypt
- Validate all inputs (use Joi validators)
- Use JWT for stateless auth
- Check permissions before database access
- Log all critical actions
- Never expose sensitive data in responses
- Use HTTPS in production
- Rate limit sensitive endpoints

## 🐛 Debugging

### View Logs
```bash
tail -f logs/app.log
```

### Debug with Node
```bash
node --inspect src/server.js
# Then open chrome://inspect
```

### Console Logs
```bash
console.log('Debug message:', data);
// Better: use Winston logger
logger.debug('Debug message', { data });
```

## 📦 Dependencies

Key packages included:
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT auth
- **bcryptjs**: Password hashing
- **joi**: Input validation
- **winston**: Logging
- **bull**: Job queue
- **socket.io**: Real-time
- **sendgrid**: Email service
- **redis**: Cache
- And more...

See `package.json` for complete list.

## 🚨 Common Issues

### MongoDB Connection Failed
- Check MONGODB_URI in .env
- Verify MongoDB is running
- Check network connectivity

### Redis Connection Failed
- Check REDIS_URL in .env
- Verify Redis is running on port 6379
- Use `redis-cli ping` to test

### Tests Failing
- Clear node_modules: `rm -rf node_modules && npm install`
- Check test database setup
- Review test output for specific errors

## 🚀 Next Steps

1. **Phase 1 (Weeks 1-4)**:
   - Week 1-2: Newsletter system
   - Week 3: Template system
   - Week 4: Notification system
   - See [CNMS_PHASEWISE_PLAN.md](../CNMS_PHASEWISE_PLAN.md)

2. **Before coding**:
   - Read [CNMS_Implementation_Plan.md](../CNMS_Implementation_Plan.md)
   - Understand feature architecture
   - Review relevant algorithm

3. **Start with**:
   - Create routes
   - Implement controllers
   - Write services
   - Add tests

---

**Last Updated**: June 2026  
**Maintained by**: Backend Team
