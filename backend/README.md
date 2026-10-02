# Kanban backend

Express 5 + TypeScript API backed by Postgres (Neon). Node runs the `.ts` files
directly (Node 24's built-in type stripping), so there's no build step.

## Setup

1. `npm install` (in this `backend/` folder)
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection
   string (Neon dashboard → Connect). `.env` is git-ignored; never commit it.
3. `npm run migrate` creates the tables
4. `npm run seed` loads the sample board (`npm run seed -- --reset` wipes and reloads)
5. `npm run dev` starts the API on http://localhost:3001 and restarts on changes

Check it: http://localhost:3001/api/health should return `{"status":"ok","database":"ok"}`.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | | `{ status, database }`; 503 if the database is unreachable |
| GET | `/api/boards` | | `[{ id, title }]` |
| GET | `/api/boards/:boardId` | | The whole board (`Board` in `shared/kanban.ts`) |
| POST | `/api/boards/:boardId/tasks` | `{ id, columnId, title }` | The task; 201 when created, 200 if that exact task already exists (a retry), 409 if the id belongs to a different task |
| PATCH | `/api/tasks/:taskId/move` | `{ toColumnId, toIndex }` | `{ task, columns }`, where `columns` maps each changed column to its new task order |

Rules the server enforces: new tasks go on top of their column; a task arriving in
a Completed column (added or moved) gets progress 100; `toIndex` past the end of a
column means "last". Invalid input gets a 400 with zod's `issues`; unknown boards,
tasks or columns get a 404. Changes to one board are serialized with a row lock on
the board, so simultaneous requests can't scramble positions.

## Tests

`npm test` runs the API tests (Node's built-in test runner) against
`TEST_DATABASE_URL`. Each run creates its own schema, runs the migrations, seeds a
fresh sample board before every test, and drops the schema at the end, so your
real data is never touched. It must be Neon's **direct** connection string (the
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
    errors.ts            HTTP errors (404, 409) used by the routes
    boards/routes.ts     endpoints + request validation (zod)
    boards/repository.ts SQL for reading boards and adding/moving tasks
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
