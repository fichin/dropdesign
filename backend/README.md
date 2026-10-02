# Kanban backend

Express 5 + TypeScript API backed by Postgres (Neon). Node runs the `.ts` files
directly (Node 24's built-in type stripping), so there's no build step.

## Setup

1. `npm install` (in this `backend/` folder)
2. Copy `.env.example` to `.env`, set `DATABASE_URL` to your Neon connection
   string (Neon dashboard → Connect) and `JWT_SECRET` to a long random string
   (the example file shows a command to generate one). `.env` is git-ignored;
   never commit it.
3. `npm run migrate` creates the tables
4. `npm run seed` loads the sample board (`npm run seed -- --reset` wipes and reloads)
5. `npm run dev` starts the API on http://localhost:3001 and restarts on changes

Check it: http://localhost:3001/api/health should return `{"status":"ok","database":"ok"}`.

## Endpoints

### Auth (public)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` | 201 `{ id, email }` and the session cookie; 409 if the email is taken; 400 for an invalid email or a password under 8 characters (or over 72 bytes) |
| POST | `/api/auth/login` | `{ email, password }` | `{ id, email }` and the session cookie; 401 `Invalid email or password` for any wrong combination |
| POST | `/api/auth/logout` | | 204, and clears the cookie |
| GET | `/api/auth/me` | | `{ id, email }` of the signed-in user, or 401 |

Emails are trimmed and lowercased, so `Ana@Example.com` and `ana@example.com` are
the same account. Passwords are hashed with bcrypt (cost 12).

### Sessions

Signing in sets a cookie named `kanban_session` holding a JWT (HS256, signed with
`JWT_SECRET`) whose subject is the user id. It lasts 7 days.

- `httpOnly`: page JavaScript can't read it, so an XSS bug can't steal it
- `SameSite=Lax`: browsers don't send it on cross-site POST/PATCH requests, which
  is what protects the JSON API from CSRF
- `Secure` (HTTPS only) when `NODE_ENV=production`

Sessions are stateless: the server keeps no session table, it just checks the
token's signature and expiry. Logging out deletes the cookie in the browser, but a
copy of the token taken before that would stay valid until it expires. Changing
`JWT_SECRET` ends every session at once.

**Deploying with the frontend on another domain** (e.g. Vercel + Render): browsers
increasingly block cookies set by a different site, and `SameSite=Lax` cookies
aren't sent cross-site at all. Serve the API under the frontend's domain instead,
for example a Vercel rewrite from `/api/*` to the Render URL, so the cookie is
first-party and nothing above needs to change.

### Boards and tasks (signed-in only)

Every route below needs a valid session; without one it returns 401
`Not signed in` before touching the database. Any signed-in user can see and
change the board (boards don't have owners yet).

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | | `{ status, database }`; 503 if the database is unreachable (public) |
| GET | `/api/boards` | | `[{ id, title }]` |
| GET | `/api/boards/:boardId` | | The whole board (`Board` in `shared/kanban.ts`) |
| POST | `/api/boards/:boardId/tasks` | `{ id, columnId, title }` | The task; 201 when created, 200 if that exact task already exists (a retry), 409 if the id belongs to a different task |
| PATCH | `/api/tasks/:taskId/move` | `{ toColumnId, toIndex }` | `{ task, columns }`, where `columns` maps each changed column to its new task order |
| PATCH | `/api/tasks/:taskId` | any of `{ title, description, priority, assigneeIds }` | The updated task. Fields left out don't change; `assigneeIds` is the complete new list in display order (`[]` clears it). 400 for an empty or over-500-character title, a description over 5,000 characters, an unknown priority, an empty body, unknown fields, a person listed twice, or a person who doesn't exist |
| DELETE | `/api/tasks/:taskId` | | `{ columns }` with the task's column in its new order; the gap it left is closed. 404 if it doesn't exist |

The board (`GET /api/boards/:boardId`) includes `people`: everyone who can be
assigned, sorted by name, in the same `{ id, name, avatarUrl }` shape as a task's
assignees. Tasks include `description` (`''` when there is none).

Rules the server enforces: new tasks go on top of their column; a task arriving in
a Completed column (added or moved) gets progress 100; `toIndex` past the end of a
column means "last". Invalid input gets a 400 with zod's `issues`; unknown boards,
tasks or columns get a 404. Changes to one board are serialized with a row lock on
the board, so simultaneous requests can't scramble positions.

## Tests

`npm test` runs the API tests (Node's built-in test runner) against
`TEST_DATABASE_URL`. Each run creates its own schema, runs the migrations, seeds a
fresh sample board before every test, and drops the schema at the end, so your
real data is never touched. Tests sign in as a test user with their own
signing key, so they don't need `JWT_SECRET`. It must be Neon's **direct** connection string (the
host without `-pooler`), because the pooler can't keep the per-connection schema
setting.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API with auto-restart |
| `npm start` | API (production) |
| `npm run migrate` | Applies new files in `migrations/`, in name order, each in a transaction |
| `npm run seed` | Loads `shared/sampleBoard.ts` if the database has no boards |
| `npm test` | API tests against a throwaway schema (needs `TEST_DATABASE_URL`) |
| `npm run typecheck` | Type-checks `src/`, `test/` and `../shared/` |

## Layout

```
backend/
  migrations/      SQL files, applied once each (tracked in schema_migrations)
  src/
    config.ts            environment variables, validated
    app.ts               Express app: middleware, routes, error handling
    server.ts            starts the app
    errors.ts            HTTP errors (401, 404, 409) used by the routes
    auth/session.ts      session cookie: sign/verify the JWT, requireAuth middleware
    auth/routes.ts       register, login, logout, me
    boards/routes.ts     endpoints + request validation (zod)
    boards/repository.ts SQL for reading boards and adding/moving/editing/deleting tasks
    db/pool.ts           Postgres connection pool + transaction helper
    db/migrations.ts     migration runner (used by migrate.ts and the tests)
    db/migrate.ts        `npm run migrate`
    db/sampleData.ts     inserts the sample board (used by seed.ts and the tests)
    db/seed.ts           `npm run seed`
  test/                  API tests
../shared/         types and sample data used by both frontend and backend
```

Adding a schema change: create the next numbered file, e.g.
`migrations/002_add_due_dates.sql`, then `npm run migrate`. Don't edit a
migration that has already been applied to a database.
