# SmartRail API

Base URL: `http://localhost:4000/api`. Successful and error responses use `{ "success": boolean, "data"?: ..., "error"?: { "code": string, "message": string } }`. Send `Authorization: Bearer <accessToken>` for authenticated endpoints. Authentication tokens are JWTs; auth routes are rate-limited.

## Authentication

- `POST /auth/register` — `{ name, email, phone?, password }`
- `POST /auth/login` — `{ email, password }`
- `GET /auth/me` — current user

## Trains and seats

- `GET /trains?from=&to=&date=&q=` and `GET /trains/search` — public train search
- `GET /trains/:id` — train details
- `GET /trains/:id/seats?date=YYYY-MM-DD` — dated availability
- `POST /trains/seats/hold` — authenticated temporary seat hold
- `POST /trains/seats/release` — release a hold by its token
- `POST /seat-allocation` — authenticated direct allocation/hold
- `POST /trains`, `PUT /trains/:id`, `DELETE /trains/:id` — admin-only train management

## Reservations and payments

- `POST /bookings` — `{ trainId, journeyDate, passengers: [{ fullName, age, gender, phone? }], seatPreference?, groupBooking?, seatIds?, paymentMethod, idempotencyKey }`
- `GET /bookings`, `GET /bookings/:id`, `GET /bookings/pnr/:pnr`
- `POST /bookings/:id/cancel` — cancellation, mock refund, and FIFO queue promotion
- `POST /payments/process` — `{ bookingId }`; mock result is success, failure, or pending
- `GET /payments/:id`
- `POST /transactions/undo` — undo the latest eligible transaction
- `GET /transactions`, `GET /transactions/:id`
- `GET /waiting-list`, `POST /waiting-list` — `{ bookingId }`; `POST /waiting-list/:id/promote` (staff/admin)

Booking requests are protected by an idempotency key. Allocation occurs in a serializable database transaction, with row-level locking and a unique `(seatId, journeyDate)` allocation constraint as the final concurrency guard. A group request prefers a contiguous run when available. The payment adapter is intentionally simulated and does not connect to a payment provider.

## Passengers, medical, analytics

- `GET /passengers`, `POST /passengers`, `GET /passengers/:id`, `PUT /passengers/:id`
- `GET /medical-requests`, `POST /medical-requests` — passenger-owned PNR requests
- `PATCH /medical-requests/:id/priority`, `PATCH /medical-requests/:id/status` — staff/admin
- `GET /analytics/occupancy`, `/analytics/bookings`, `/analytics/revenue` — staff/admin
- `GET /health` — API liveness

All request bodies are validated with Zod. Medical records are demonstration data only; they do not dispatch real-world emergency assistance.
