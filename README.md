# submission-approval-workflow

Initial scaffold for a full-stack technical assessment project with a NestJS backend, a React + Vite frontend, PostgreSQL, and Prisma for data access.

## Stack

- Backend: NestJS + TypeScript
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL
- ORM: Prisma

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
3. Install backend dependencies, generate the Prisma client, and run migrations.
4. Install frontend dependencies and run the web app.

## Commands

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
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

## Data Model

### Users

- `User` stores people who interact with the workflow.
- Each user has a UUID identifier, name, unique email, password hash, and a role.
- Roles are `APPLICANT` and `REVIEWER`.

### Applications

- `Application` stores each assessment submission owned by a user.
- Each application has a UUID identifier, title, category, optional description, optional amount, and workflow status.
- A user can own many applications.

### Audit Logs

- `AuditLog` records status transitions for an application.
- Each log stores the actor, the application, the previous status, the new status, an optional comment, and a timestamp.
- An application can have many audit log entries.

### Workflow Enums

- Roles: `APPLICANT`, `REVIEWER`
- Statuses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `RETURNED`
- Categories: `GENERAL`, `FINANCE`, `HR`, `IT`

## Prisma Commands

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
```

`prisma/seed.ts` creates two idempotent test users with Prisma `upsert`.

## Test Credentials

- Applicant: `applicant@example.com` / `password123`
- Reviewer: `reviewer@example.com` / `password123`

## Authentication

- `POST /auth/login` authenticates a seeded user with email and password.
- Passwords are verified with `bcrypt`.
- Successful logins return a signed JWT access token and the authenticated user payload.
- JWT-based guards and role-based authorization primitives are available for protected endpoints.

Example request:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "applicant@example.com",
  "password": "password123"
}
```

Example response:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user-uuid",
    "name": "Applicant",
    "email": "applicant@example.com",
    "role": "APPLICANT"
  }
}
```

## Current Backend Scope

- `GET /health` returns the backend health status.
- Application workflow endpoints and business logic are intentionally not implemented yet.
