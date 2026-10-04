# SmartRail

Railway Reservation Management System with a React/Vite frontend and an Express, TypeScript, PostgreSQL, and Prisma API.

## Run locally

The frontend requires the API and a signed-in account; it does not provide local sample records when the backend is unavailable.

```sh
npm install
npm run dev
```

Full stack (Docker Compose required):

```sh
docker compose up -d postgres
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Set `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and one-time bootstrap administrator values (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD`) in `backend/.env`. The admin password must be at least 12 characters. Start the frontend in a second terminal with `npm run dev`; `VITE_API_URL` defaults to `http://localhost:4000/api`.

The seed command provisions only the explicitly configured administrator; it does not create demo accounts, trains, bookings, passengers, or medical requests. Load an authoritative timetable and coach inventory through the admin API before accepting reservations. Booking and seat allocation use serializable transactions and a database uniqueness constraint. A real payment provider is not configured: new paid reservations remain pending and seats are held temporarily, and payment processing returns a clear service-unavailable error until a provider is integrated. Medical requests are persisted operational records; they do not dispatch emergency services.

## Verification

```sh
npm run build
cd backend
npm run build
npm test
npx prisma validate
```

The seat contention integration test runs only when `RUN_DB_TESTS=1` and a migrated PostgreSQL database is available. See [backend/API.md](backend/API.md) for routes and request examples.

Run the live transaction tests against a dedicated database whose name contains `test`:

```sh
cd backend
npm run test:db
```

The runner uses `DATABASE_TEST_URL`, applies migrations, and enables the DB suite. It refuses database names that do not contain `test`.

## Deployment

- **Vercel:** Import the repository root. The root `vercel.json` builds the Vite app to `dist` and rewrites SPA routes. Set `VITE_API_URL` to the deployed API's `/api` URL. This repository has no Next.js `/frontend` project.
- **Railway API:** Create a service with its root directory set to `/backend`. It uses `backend/Dockerfile` and `backend/railway.json`; migrations run as a pre-deploy command before the API starts. Set `DATABASE_URL`, a unique `JWT_SECRET` (at least 32 characters), and `FRONTEND_URL` to the deployed frontend origin. For initial administrator provisioning, configure `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` and run `npm run db:seed` once. Railway supplies `PORT`.
- **Secrets:** Never deploy the example credentials. `DATABASE_TEST_URL` and `RUN_DB_TESTS=1` are for CI/local integration tests, not the production API. Provision the initial admin once with `npm run db:seed` after setting its environment values.

## Modules

- Operations dashboard, train search, bookings, group booking, passengers, and seat allocation
- FIFO waiting queue, PNR lookup, cancellation, transaction history, and undo
- Medical priority queue and occupancy analytics
- JWT authentication with role-based access controls
- Prisma-backed REST API, seed data, Docker Compose database, and API documentation
