# submission-approval-workflow

Inital push for full-stack-developer technical assessment project with a NestJS backend, a React + Vite frontend, and PostgreSQL via Docker Compose.

## Stack

- Backend: NestJS + TypeScript
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL

## Project Structure

```text
submission-approval-workflow/
  backend/
  frontend/
  docker-compose.yml
  .env.example
  README.md
```

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with Docker Compose.
3. Install backend dependencies and run the API.
4. Install frontend dependencies and run the web app.

## Commands

Backend:

```bash
cd backend
npm install
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Database:

```bash
docker compose up -d
```



