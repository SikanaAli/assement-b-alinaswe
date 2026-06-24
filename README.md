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

## Workflow Rules

- The backend keeps status transition rules in a dedicated `ApplicationWorkflowService`.
- Controllers should delegate workflow validation to this service rather than embedding transition logic.
- Applicants can only submit their own `DRAFT` applications.
- Only the owner can edit an application, and only while it is in `DRAFT`.
- Reviewers can move `SUBMITTED` applications to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `RETURNED`.
- Reviewers can move `UNDER_REVIEW` applications to `APPROVED`, `REJECTED`, or `RETURNED`.
- `APPROVED` and `REJECTED` are terminal states.
- `REJECTED` and `RETURNED` require a non-empty comment.
- Illegal transitions raise domain-level workflow errors designed to map cleanly to HTTP `400` or `403` responses.

## Applicant APIs

- `POST /applications` creates a `DRAFT` application for the authenticated applicant.
- `GET /applications/my` lists applications owned by the authenticated applicant.
- `GET /applications/:id` returns a single application. Applicants can view only their own; reviewers can view any.
- `PATCH /applications/:id` updates an applicant-owned application only while it is still `DRAFT`.
- `POST /applications/:id/submit` submits a draft application and records an audit log from `DRAFT` to `SUBMITTED`.

Create example:

```http
POST /applications
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Office Laptop Refresh",
  "category": "IT",
  "description": "Requesting replacement hardware for the design team.",
  "amount": 2400
}
```

Submit example:

```http
POST /applications/<applicationId>/submit
Authorization: Bearer <accessToken>
```

## Current Backend Scope

- `GET /health` returns the backend health status.
- Applicant-facing application endpoints are implemented.
- Reviewer transition endpoints and broader workflow business actions are intentionally not implemented yet.
