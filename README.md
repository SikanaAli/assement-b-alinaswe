# submission-approval-workflow

Full-stack technical assessment project for a submission approval workflow. The stack includes a NestJS API, a React + Vite frontend, PostgreSQL, and Prisma.

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
2. Optionally copy `frontend/.env.example` to `frontend/.env` for local Vite API URL overrides.
3. Install backend and frontend dependencies if you also want to run commands outside Docker.
4. Start PostgreSQL, the backend, and the frontend with Docker Compose.
5. The backend container applies Prisma migrations and runs the idempotent seed automatically on startup.

## Commands

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
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
docker compose up -d --build
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

Start PostgreSQL, the backend, and the frontend:

```bash
docker compose up -d --build
```

The backend container waits for PostgreSQL to become healthy and then starts on `http://127.0.0.1:3000`.
The frontend container serves the React app on `http://127.0.0.1:8080`.
It also runs `prisma migrate deploy` and the idempotent seed script during container startup.
Local frontend origins are allowed through CORS by default for `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:8080`, and `http://localhost:8080`.
Override `FRONTEND_ORIGIN` in `.env` if you use a different frontend origin.

Run Prisma migrations from the backend directory:

```bash
cd backend
npm run prisma:migrate:deploy
```

Seed the database:

```bash
cd backend
npm run prisma:seed
```

If you are changing the Prisma schema locally and need to create a new migration:

```bash
cd backend
npm run prisma:migrate
```

If you prefer to run the frontend separately:

```bash
cd frontend
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```
#### Health-check endpoint is just a smoke screen 	(҂◡_◡) ᕤ no check are being peformed

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
- Only the owner can edit an application, and only while it is in `DRAFT` or `RETURNED`.
- Saving a `RETURNED` application moves it back to `DRAFT` so the applicant can revise and resubmit it.
- Reviewers can move `SUBMITTED` applications to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `RETURNED`.
- Reviewers can move `UNDER_REVIEW` applications to `APPROVED`, `REJECTED`, or `RETURNED`.
- `APPROVED` and `REJECTED` are terminal states.
- `REJECTED` and `RETURNED` require a non-empty comment.
- Illegal transitions raise domain-level workflow errors designed to map cleanly to HTTP `400` or `403` responses.

## Applicant APIs

- `POST /applications` creates a `DRAFT` application for the authenticated applicant.
- `GET /applications/my` lists applications owned by the authenticated applicant.
- `GET /applications/:id` returns a single application. Applicants can view only their own; reviewers can view any.
- `PATCH /applications/:id` updates an applicant-owned application only while it is `DRAFT` or `RETURNED`. Updating a returned application moves it back to `DRAFT`.
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

- `GET /applications/reviewer/queue` returns the reviewer queue and supports filtering by `status` and `category`, free-text search, and pagination via `page` and `pageSize`.
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

Unit tests:

```bash
cd backend
npm test
```

End-to-end tests:

```bash
cd backend
npm run test:e2e
```

The test coverage currently verifies:

- workflow transition rules in `ApplicationWorkflowService`
- applicant submission flow
- reviewer approval flow
- audit log creation for key transitions
- rejection without comment returning `400`
- applicant review actions returning `403`
- editing a submitted application returning `403`
- editing a returned application moving it back to `DRAFT`
- the current edit-after-submit behavior returning `403` because the workflow treats post-submission edits as a forbidden action rather than a malformed request

E2E test note:

- `TEST_DATABASE_URL` should point to a dedicated test database for normal development use.
- The e2e suite reapplies migrations during startup and resets `Application` and `AuditLog` data before each test.

## Frontend Notes

- The login form uses the seeded credentials above.
- Applicant views include loading, empty, and error states for list/detail/form pages.
- Reviewer views include loading, empty, and error states for the queue and detail actions.
- Success feedback is shown after submit and reviewer transition actions.
- Applicant-only and reviewer-only actions are hidden in the UI based on the authenticated role, while backend authorization remains the source of truth.

## AI Usage Disclosure

- ChatGPT was used dusing the planing phase to break down the asessment into tasks as well as guidance on creating this mini-mono-repo.
- Codex (vs-code extention) was used to clean up and support on bug-fixes as well as writing tests and peforming a final pass check.
- Codex also run a check on the README and made a few addition to what was no initalo explaind in the RERADME e.g Tade-off and Testing

## Trade-offs
- One key thing i would fix the the router in the frontend. while on localhost it seams to work fine, once deployed, it kinda breaks on refresh
- I would also breaks this into components for better code maintainability as opposed to having most of the logic in a signle file i.e App.tsx
- Swagger request documentation is explicit, but most response bodies are still inferred from returned objects rather than dedicated response DTOs.
- The frontend is intentionally compact and keeps most state in a single `App.tsx` file to stay within assessment scope.
- Docker Compose is optimized for reproducible local development rather than production deployment hardening.

## Current Backend Scope

- `GET /health` returns the backend health status though this is just a smoke screen and no check are ebing peformed (ㆆ _ ㆆ).
- Applicant-facing application endpoints are implemented.
- Reviewer queue and transition endpoints are implemented.
- Broader workflow business actions are intentionally not implemented yet.
