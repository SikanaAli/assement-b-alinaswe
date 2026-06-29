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
2. Optionally copy `frontend/.env.example` to `frontend/.env` for Vite API URL overrides. `backend/.env.example` mirrors the backend variables for reference.
3. Install backend and frontend dependencies.
4. Start PostgreSQL, frontend and the backend with Docker Compose.
5. Seed the database.
6. Run the frontend separately with Vite.

#### Note: Runing the backend without using the docker compose file will likely fail, unless you did the smart thing (͡ ° ͜ʖ ͡ °)... the connection string the .env points to a working postgres database

## Commands

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Infrastructure:

```bash
docker compose up -d
```

## Local Development

Root environment:

```bash
cp .env.example .env
```

Optional service-local environment files:

```bash
cp frontend/.env.example frontend/.env
```

Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Start PostgreSQL and the backend:

```bash
docker compose up -d
```

The backend container waits for PostgreSQL to become healthy and then starts on `http://127.0.0.1:3000`.
It also runs `prisma migrate deploy` during container startup.
Local frontend origins are allowed through CORS by default for `http://127.0.0.1:5173` and `http://localhost:5173`.
Override `FRONTEND_ORIGIN` in `.env` if you use a different frontend origin.

Run Prisma migrations from the backend directory:

```bash
cd backend
npm run prisma:migrate
```

Seed the database:

```bash
cd backend
npm run prisma:seed
```

Run the frontend separately:

```bash
cd frontend
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```
#### Health-check is just a smoke screen and no actual checks are being peformed

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
- Only the owner can edit an application while it is in `DRAFT` or `RETURNED`.
- When an applicant edits a `RETURNED` application, the save transitions it back to `DRAFT` so it can be resubmitted.
- Reviewers can move `SUBMITTED` applications to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `RETURNED`.
- Reviewers can move `UNDER_REVIEW` applications to `APPROVED`, `REJECTED`, or `RETURNED`.
- `APPROVED` and `REJECTED` are terminal states.
- `REJECTED` and `RETURNED` require a non-empty comment.
- Illegal transitions raise domain-level workflow errors designed to map cleanly to HTTP `400` or `403` responses.

## Applicant APIs

- `POST /applications` creates a `DRAFT` application for the authenticated applicant.
- `GET /applications/my` lists applications owned by the authenticated applicant.
- `GET /applications/:id` returns a single application. Applicants can view only their own; reviewers can view any.
- `PATCH /applications/:id` updates an applicant-owned application while it is in `DRAFT` or `RETURNED`.
- Saving a `RETURNED` application records an audit log from `RETURNED` to `DRAFT`.
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

## Reviewer APIs

- `GET /applications/reviewer/queue` returns the reviewer queue and supports optional filtering by `status`, `category`, and `search`, plus `page` and `pageSize` pagination.
- `POST /applications/:id/transition` applies reviewer transitions and creates an audit log entry.
- Reviewer transitions are limited to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, and `RETURNED`.

Reviewer queue example:

```http
GET /applications/reviewer/queue?status=SUBMITTED&category=FINANCE&search=budget&page=1&pageSize=10
Authorization: Bearer <reviewerAccessToken>
```

Reviewer transition example:

```http
POST /applications/<applicationId>/transition
Authorization: Bearer <reviewerAccessToken>
Content-Type: application/json

{
  "status": "APPROVED",
  "comment": "Looks good"
}
```

## Testing

- Unit tests: `cd backend && npm test`
- E2E tests: `cd backend && npm run test:e2e`
- E2E tests require `TEST_DATABASE_URL` to point to a dedicated test database.
- When using the local Docker Postgres service, create the test database once before running e2e tests.
- The e2e suite resets `Application` and `AuditLog` data before each test and reapplies migrations to the test database during startup.
- Covered rules include applicant self-approval denial, reviewer approval with audit trail creation, reviewer rejection comment requirements, and applicant edit denial after submission.
- The current edit-after-submit behavior returns `403` because the workflow treats post-submission edits as a forbidden action rather than a malformed request.

Create the local test database once:

```bash
docker exec submission-approval-workflow-postgres psql -U workflow_user -d postgres -c "CREATE DATABASE workflow_db_test"
```

## Current Backend Scope

- `GET /health` returns the backend health status (still a smoke screen 	(ㆆ _ ㆆ)).
- Applicant-facing application endpoints are implemented.
- Reviewer queue and transition endpoints are implemented.
- Broader workflow business actions are intentionally not implemented yet.

## AI Usage Disclosure

- ChatGPT was used dusing the planing phase to break down the asessment into tasks as well as guidance on creating this mini-mono-repo.
- Codex (vs-code extention) was used to clean up and support on bug-fixes as well as writing tests and peforming a final pass check.
- Codex also run a check on the README and made a few addition to what was no initalo explaind in the RERADME e.g Tade-off and Testing

## Trade-offs

- The frontend is intentionally compact and still keeps most application logic in `frontend/src/App.tsx` to reduce setup overhead for the assessment.
- Automated coverage is strongest on backend workflow rules and API behavior; browser-level frontend tests are not included.
- Swagger/Scalar request documentation is thorough, but response bodies are still documented mostly by runtime examples rather than dedicated response DTO classes.
- Local Docker Compose is optimized for assessment setup speed and currently focuses on PostgreSQL plus the backend API; the frontend is still documented to run separately with Vite in this branch.
