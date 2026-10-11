# Passenger User Frontend

The passenger portal for the Railway Reservation & Management System. This folder contains the public landing page and the signed-in passenger experience. It is a standalone HTML, CSS, and vanilla JavaScript app that uses the repository's passenger mock data and is structured around the shared API contract.

## Run locally

From the repository root, start a static file server:

```bash
python3 -m http.server 4173 --directory frontend/user
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/) in a browser. No npm install or build step is required. If port `4173` is already in use, replace it with another port, such as `4174`, and open that address instead.

## Demo passenger account

Use the seeded passenger account to explore signed-in pages:

| Field | Value |
| --- | --- |
| Email | `rahul.sharma@example.com` |
| Password | `Password123!` |

You can also create a passenger account from the sign-in dialog. Mock account and booking changes are saved in the browser's local storage for this portal.

## Features

### Public portal

- Search trains by station, date, class, and quota.
- View train routes and timetable stops.
- Check a sample PNR and its passenger statuses.
- View simulated train running status and derived schedule alerts.
- Search for two-leg connections using the route and availability fixtures.
- Read support FAQs and sign in to submit a grievance.

### Passenger account

- Register and sign in as a passenger.
- Search trains, select a class and passengers, review a fare breakdown, and complete a mock payment.
- View a booking confirmation and printable ticket details.
- View booking history, check PNR status, and cancel a booking with a refund preview.
- Edit profile details and manage saved passengers.
- Submit and review TDR claims and grievances.
- View notifications and mark them as read.

## Project files

| Path | Purpose |
| --- | --- |
| `index.html` | Public landing page, passenger portal views, forms, and dialogs |
| `styles.css` | Responsive portal styling |
| `app.js` | Page behavior, booking flow, and UI rendering |
| `services/mockService.js` | Async data access and mock behavior for the portal |
| `mock-data/` | JSON fixtures for users, trains, routes, schedules, availability, bookings, and related records |

## API contract and mock behavior

The shared API definition is in [`../../docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md), and field/enumeration definitions are in [`../../docs/DATA_SCHEMA.md`](../../docs/DATA_SCHEMA.md). Keep request and response field names consistent with those documents when changing the service layer.

The current portal runs against `frontend/user/mock-data/`; it does not make requests to a live backend. The mock service simulates booking, payment, cancellation, profile, saved passenger, notification, TDR, and grievance operations. Train running status and alerts are derived from the sample schedules, so they are not live railway data or GPS tracking. Connection results are computed from the sample routes and availability and may be empty for some station/date pairs.

Changes made through the UI are stored in browser local storage. To reset the demo to the checked-in fixtures, clear the site's local storage in browser developer tools and reload the portal. A new browser session may require signing in again.

## Team contribution notes

- Keep passenger portal changes inside `frontend/user/` unless the team agrees to change shared files.
- Do not edit shared API contract or mock-data files to work around a missing endpoint. Record contract gaps for the backend/API owners instead.
- When ready to share, stage this directory from the repository root with `git add frontend/user`, review the staged changes, and push a feature branch for team review.
