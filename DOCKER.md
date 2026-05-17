# 🐳 Docker Setup Guide - Goal Setting & Tracking Portal

This guide will help you run the portal using Docker and Docker Compose.

---

## Prerequisites

Install the following:
- **Docker** ([Download](https://www.docker.com/products/docker-desktop))
- **Docker Compose** (included with Docker Desktop)

Verify installation:
```bash
docker --version
docker-compose --version
```

---

## 🚀 Quick Start (5 minutes)

### Step 1: Clone & Navigate
```bash
cd portal
```

### Step 2: Create Environment File
```bash
# Copy the default Docker environment
cp .env.docker .env.local
```

### Step 3: Start All Services
```bash
docker-compose up -d
```

This will:
- ✅ Start PostgreSQL database
- ✅ Start Redis server
- ✅ Build and start the Next.js application
- ✅ Run database migrations automatically
- ✅ Seed demo data

### Step 4: Access the Application
Open your browser and navigate to:
- **Portal**: [http://localhost:3000](http://localhost:3000)
- **Login**: [http://localhost:3000/login](http://localhost:3000/login)

### Step 5: Demo Login
Use any of these credentials:
- **Admin**: `admin@demo.com` / `Admin@123`
- **Manager**: `manager1@demo.com` / `Manager@123`
- **Employee**: `employee1@demo.com` / `Employee@123`

---

## 📋 Common Commands

### Start Services
```bash
# Start in background
docker-compose up -d

# Start and watch logs
docker-compose up

# Start specific service
docker-compose up postgres redis
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v
```

### View Logs
```bash
# View all logs
docker-compose logs

# View logs for specific service
docker-compose logs app
docker-compose logs postgres
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f app
```

### Execute Commands
```bash
# Run bash shell in app container
docker-compose exec app bash

# Run npm commands
docker-compose exec app npm test
docker-compose exec app npm run build

# Access PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d portal_db

# Access Redis CLI
docker-compose exec redis redis-cli
```

---

## 🔧 Development Setup (with Hot Reload)

For development with live code reloading and admin panels:

```bash
# Start with development configuration
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This includes:
- ✅ Hot reload on code changes
- ✅ PgAdmin UI ([http://localhost:5050](http://localhost:5050))
- ✅ Redis Commander ([http://localhost:8081](http://localhost:8081))
- ✅ Node debugger port (9229)

### Development Admin Panel Login
- **PgAdmin Email**: `admin@example.com`
- **PgAdmin Password**: `admin`

---

## 🧪 Running Tests in Docker

```bash
# Run all tests
docker-compose exec app npm test

# Run tests in watch mode
docker-compose exec app npm test:watch

# Run specific test file
docker-compose exec app npm test goal-sheets.test.ts

# Run with coverage
docker-compose exec app npm test -- --coverage
```

---

## 🗄️ Database Management

### Reset Database (WARNING: Deletes all data)
```bash
docker-compose exec app npx prisma db reset
```

### View Database Schema
```bash
docker-compose exec app npx prisma studio
```

### Manual Migration
```bash
docker-compose exec app npx prisma migrate dev --name your_migration_name
```

### Seed Database
```bash
docker-compose exec app npm run seed
```

---

## 📊 Monitor Services

### Check Service Status
```bash
docker-compose ps
```

### View Resource Usage
```bash
docker stats
```

### Health Check Status
```bash
# Check app health
docker-compose exec app wget --quiet --tries=1 --spider http://localhost:3000/api/health

# Check database health
docker-compose exec postgres pg_isready

# Check Redis health
docker-compose exec redis redis-cli ping
```

---

## 🔐 Environment Variables

### Custom Configuration
Create a `.env` file to override defaults:

```bash
# Example: Change database password
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=my_portal_db

# Change NextAuth secret
NEXTAUTH_SECRET=my-super-secret-key-min-32-chars

# Enable email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@portal.example.com
```

Then restart services:
```bash
docker-compose down
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port mapping in docker-compose.yml
# Change: "3000:3000" to "3001:3000"
# Or kill existing process using port 3000
docker-compose down
```

### Database Connection Refused
```bash
# Ensure postgres is healthy
docker-compose ps
# Should show "healthy" status

# Check postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

### Redis Connection Error
```bash
# Restart redis
docker-compose restart redis

# Verify redis is running
docker-compose exec redis redis-cli ping
# Should return "PONG"
```

### Out of Disk Space
```bash
# Clean up Docker resources
docker system prune -a

# Or just unused volumes
docker volume prune
```

### Application Won't Start
```bash
# Check app logs
docker-compose logs app

# Rebuild image
docker-compose build --no-cache

# Force rebuild and restart
docker-compose down
docker-compose up --build
```

---

## 📈 Production Deployment

### Before Going Live
1. Change `NEXTAUTH_SECRET` to a secure random value
2. Change `INTERNAL_SECRET` to a secure random value
3. Update `NEXTAUTH_URL` to your production domain
4. Set `NODE_ENV=production`
5. Remove PgAdmin and Redis Commander from production compose file

### Production Docker Compose
```bash
# Use only the main docker-compose.yml
docker-compose -f docker-compose.yml up -d
```

### Building for Production
```bash
# Build image for production
docker build -t myregistry/portal:latest .

# Push to registry
docker push myregistry/portal:latest
```

---

## 📚 File Structure

```
portal/
├── Dockerfile                 # Multi-stage build for production
├── docker-compose.yml         # Production-ready compose file
├── docker-compose.dev.yml     # Development additions (hot reload, admin panels)
├── .env.docker               # Default environment variables
├── .dockerignore              # Files to exclude from image
└── ... (other project files)
```

---

## 🆘 Getting Help

### View All Available Commands
```bash
docker-compose --help
docker --help
```

### Check Service Health
```bash
docker-compose ps

# Output example:
# NAME                    STATUS
# portal-app              Up 5 minutes (healthy)
# portal-postgres         Up 5 minutes (healthy)
# portal-redis            Up 5 minutes (healthy)
```

### Debug a Specific Service
```bash
# View detailed logs
docker-compose logs app --tail=100

# Execute interactive shell
docker-compose exec app bash
```

---

## ✨ Quick Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Run tests
docker-compose exec app npm test

# Access app shell
docker-compose exec app bash

# Access database
docker-compose exec postgres psql -U postgres -d portal_db

# Access Redis
docker-compose exec redis redis-cli

# Stop and clean up
docker-compose down -v
```

---

## 🎉 You're Ready!

Your Goal Setting & Tracking Portal is now running in Docker! 

Access it at: **[http://localhost:3000](http://localhost:3000)**

Happy coding! 🚀
