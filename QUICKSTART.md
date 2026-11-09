# 🚀 CNMS Project - Quick Start Guide

Welcome! This guide will get you up and running in 5 minutes.

## 📋 Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- MongoDB 5.0+ ([Download](https://www.mongodb.com/try/download/community) OR use Docker)
- Redis 6.0+ ([Download](https://redis.io/download) OR use Docker)

## ⚡ Fastest Setup (Docker)

If you have Docker & Docker Compose installed:

```bash
# Clone or extract the project
cd CNMS_PROJECT

# Start all services (MongoDB, Redis, Backend, Frontend)
docker-compose up

# Services will be available at:
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
# MongoDB: localhost:27017
# Redis: localhost:6379
```

**Done!** The entire stack is running. Open http://localhost:5173 in your browser.

## 🛠️ Manual Setup (Without Docker)

### Step 1: Start MongoDB

```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Windows - Use MongoDB installer
# Linux
sudo service mongod start

# Or using Docker
docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=password mongo:6.0
```

### Step 2: Start Redis

```bash
# macOS (with Homebrew)
brew services start redis

# Windows - Use Redis installer
# Linux
sudo service redis-server start

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### Step 3: Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev

# Backend runs on http://localhost:5000
```

### Step 4: Frontend Setup (New Terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev

# Frontend runs on http://localhost:5173
```

**Done!** Open http://localhost:5173

---

## 📚 Project Documentation

**Important Files to Read First**:

1. **README.md** - Project overview
2. **CNMS_PHASEWISE_PLAN.md** - Implementation timeline (THIS IS KEY!)
3. **CNMS_Implementation_Plan.md** - Feature details & algorithms
4. **backend/README.md** - Backend setup & structure
5. **frontend/README.md** - Frontend setup & structure

---

## 🎯 What to Do Next

### For Everyone
1. Read the main [README.md](README.md)
2. Read [CNMS_PHASEWISE_PLAN.md](CNMS_PHASEWISE_PLAN.md) to understand the timeline
3. Check if your local setup is working (see below)

### For Backend Developers
1. Read [backend/README.md](backend/README.md)
2. Review [CNMS_Implementation_Plan.md](CNMS_Implementation_Plan.md) - Phase 1 features
3. Check Week 1-2 tasks in [CNMS_PHASEWISE_PLAN.md](CNMS_PHASEWISE_PLAN.md)

### For Frontend Developers
1. Read [frontend/README.md](frontend/README.md)
2. Review [CNMS_Implementation_Plan.md](CNMS_Implementation_Plan.md) - UI components
3. Understand Redux state management

### For DevOps/Full-Stack
1. Review Docker setup in docker-compose.yml
2. Check CI/CD requirements in Phase 3 of phasewise plan
3. Plan infrastructure (AWS, GCP, or on-premise)

---

## ✅ Verify Your Setup

### Backend
```bash
cd backend
curl http://localhost:5000/health
# Should return 200 OK
```

### Frontend
```bash
# Open http://localhost:5173 in browser
# Should see CNMS login page
```

### Database
```bash
# MongoDB
mongosh mongodb://root:password@localhost:27017/cnms --authenticationDatabase admin

# Redis
redis-cli ping
# Should return PONG
```

---

## 🔧 Common Setup Issues

### "MongoDB Connection Failed"
- Ensure MongoDB is running: `mongodb://root:password@localhost:27017/cnms`
- Check .env file has correct MONGODB_URI
- Run: `mongosh mongodb://root:password@localhost:27017 --authenticationDatabase admin`

### "Redis Connection Failed"
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL in .env
- Default: `redis://localhost:6379`

### "Cannot find module..."
```bash
# Backend
cd backend && rm -rf node_modules && npm install

# Frontend
cd frontend && rm -rf node_modules && npm install
```

### "Port Already in Use"
```bash
# Backend (change 5000)
PORT=5001 npm run dev

# Frontend (change 5173)
npm run dev -- --port 5174
```

### "npm install takes forever"
```bash
# Try with npm ci instead
npm ci

# Or clear npm cache
npm cache clean --force
npm install
```

---

## 📝 Environment Variables

### Backend (.env)
Create `backend/.env` from `backend/.env.example`:
```
MONGODB_URI=mongodb://root:password@localhost:27017/cnms?authSource=admin
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your_key_here
JWT_SECRET=your_secret_here
```

### Frontend (.env)
Create `frontend/.env` from `frontend/.env.example`:
```
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=CNMS
```

---

## 🧪 Testing Your Changes

### Backend
```bash
cd backend
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:coverage # With coverage
```

### Frontend
```bash
cd frontend
npm run test          # Run tests
npm run test:coverage # With coverage
```

---

## 📂 Folder Structure Quick Reference

```
CNMS_PROJECT/
├── backend/           ← Node.js/Express API
├── frontend/          ← React web app
├── mobile/            ← React Native (optional)
├── docs/              ← Documentation
├── README.md          ← Start here!
├── CNMS_PHASEWISE_PLAN.md ← Implementation timeline
└── CNMS_Implementation_Plan.md ← Feature details
```

---

## 🚀 First Task (Pick One)

### Backend Developer
- [ ] Setup backend locally
- [ ] Run tests: `npm run test:coverage`
- [ ] Read Week 1-2 tasks in phasewise plan
- [ ] Start with Event model or Newsletter service

### Frontend Developer
- [ ] Setup frontend locally
- [ ] Run: `npm run dev` and open http://localhost:5173
- [ ] Check Redux store setup
- [ ] Start with Dashboard component

### Full-Stack
- [ ] Run full stack with docker-compose
- [ ] Write a simple API endpoint
- [ ] Create corresponding React component
- [ ] Test end-to-end

---

## 💡 Pro Tips

1. **Use VS Code** with extensions:
   - ESLint
   - Prettier
   - MongoDB
   - REST Client

2. **Keep terminals open**:
   - Terminal 1: Backend (`npm run dev`)
   - Terminal 2: Frontend (`npm run dev`)
   - Terminal 3: Git/npm commands

3. **Read before coding**:
   - Always read the phasewise plan first
   - Understand what to build before building
   - Check if code already exists

4. **Test as you go**:
   - Write tests alongside code
   - Run tests before committing
   - Aim for 80%+ coverage

---

## 🆘 Need Help?

1. **Check documentation**: README files in each folder
2. **Search issues**: GitHub issues (if using GitHub)
3. **Ask in team chat**: Slack, Teams, Discord
4. **Create an issue**: Document what's not working
5. **Read error carefully**: 90% of issues have clear error messages

---

## 📅 What's Next?

After setup is complete:
1. **Week 1-2**: Start Phase 1 - Newsletter System
2. **Week 3**: Template System
3. **Week 4**: Notification System
4. See [CNMS_PHASEWISE_PLAN.md](CNMS_PHASEWISE_PLAN.md) for detailed tasks

---

**Questions?** Read the main README.md or check project documentation.

**Ready to code?** Let's go! 🎉

---

**Last Updated**: June 2026
