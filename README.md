# SmartRail

Railway Reservation Management System with a React/Vite frontend and an Express, TypeScript, PostgreSQL, and Prisma API.

## Run locally

Frontend demo mode (no database):

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

In a second terminal, run the frontend with `npm run dev`. The API defaults to `http://localhost:4000`; `VITE_API_URL` defaults to that address. Backend environment values and the local Docker database credentials are for development only. Set a unique `JWT_SECRET` of at least 32 characters before exposing the API.

Seed accounts (all use `SmartRailDemo#2026`): `admin@smartrail.demo`, `staff@smartrail.demo`, and `passenger@smartrail.demo`.

The payment adapter is deliberately a mock and never charges money. It supports success, failure, and pending outcomes. Booking and seat allocation use serializable transactions plus row locks and a database uniqueness constraint to prevent duplicate seat/date allocation. Cancellation records refunds and promotes the FIFO waiting queue; undo is limited to the latest reversible transaction. Medical requests are demo records and do not contact emergency services.

## Verification

```sh
npm run build
cd backend
npm run build
npm test
npx prisma validate
```

The seat contention integration test runs only when `RUN_DB_TESTS=1` and a migrated PostgreSQL database is available. See [backend/API.md](backend/API.md) for routes and request examples.

## Modules

- Operations dashboard, train search, bookings, group booking, passengers, and seat allocation
- FIFO waiting queue, PNR lookup, cancellation, transaction history, and undo
- Medical priority queue and occupancy analytics
- JWT authentication with role-based access controls
- Prisma-backed REST API, seed data, Docker Compose database, and API documentation
