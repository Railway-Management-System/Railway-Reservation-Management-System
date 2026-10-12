# Staff / Ticket Collector (TC) Operations Terminal (Track 2)

Welcome to the **Staff / Ticket Collector (TC) Operations Dashboard** for the **Railway Reservation & Management System**.

## 1. Overview & Capabilities

This dashboard is engineered for onboard train conductors, ticket examiners, and station personnel. It runs 100% offline-ready against standardized mock fixtures with reactive `localStorage` persistence.

### Key Functional Modules

1. **Duty Roster & Shift Overview**:
   - Real-time roster details: Assigned Train (12951 Mumbai Tejas Rajdhani), assigned coaches (`B1`, `B2`, `A1`), shift timing, and active personnel profile.
   - Quick KPI metrics: Total passengers, boarded count, no-shows, vacant berth pool, and penalty revenues collected.
   - Instant personnel switcher between Vikram Singh (TC), Sunita Rao (Station Manager), and Ramesh Nair (TC).

2. **Passenger Chart & Manifest**:
   - Coach-wise passenger manifest (`B1`, `B2`, `A1`, `H1`).
   - Real-time search across Name, PNR, Seat Number, and ID Reference.
   - 1-click **Boarded** (`BOARDED`) vs **No-Show** (`NO_SHOW`) status toggle.
   - Marking a passenger as `NO_SHOW` automatically releases their occupied berth directly into the Vacancy Reallocation Pool!

3. **Digital PNR & Identity Scanner**:
   - Quick PNR inspection terminal with sample quick-test buttons (`2849102841`, `5183920194`, `4920194820`).
   - Real-time inspection of official ID proof on record (`AADHAAR`, `PAN`, `PASSPORT`, `DRIVING_LICENSE`, `VOTER_ID`).
   - Official TC verification stamps: `VALID`, `INVALID`, `MISMATCH` with inspector remarks.

4. **Vacancy Management & RAC Promotion**:
   - Real-time vacant berths pool detailing coach, seat, berth type, and vacancy reason (e.g. No-Show, cancellation).
   - Priority queue of passengers in `RAC` (Reservation Against Cancellation) and `WAITING_LIST`.
   - 1-click **Promote RAC Passenger** which automatically assigns the vacant berth and upgrades booking status to `CONFIRMED`.

5. **On-Spot Penalty Fine Management**:
   - Issue official fine challans for violations: `TICKETLESS_TRAVEL`, `TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE`, `UNBOOKED_EXCESS_LUGGAGE`, `SMOKING_NUISANCE`, etc.
   - Real-time calculation of collected vs unpaid penalties.
   - Digital printable/downloadable penalty e-receipt with official Indian Railways styling.

6. **Operations & Delay Dispatcher**:
   - Live route timetable with intermediate arrival/departure times, distances, and assigned platforms.
   - Operational delay broadcaster (reporting minutes delayed, operational status `ON_TIME` / `DELAYED`, and platform shifts).

7. **Crowd & Cleanliness Monitoring**:
   - Platform headcount and crowd density assessor (`LOW`, `MODERATE`, `HIGH`, `OVERCROWDED`).
   - Housekeeping ticket dispatcher for coach/washroom hygiene issues (`TOILET_DIRTY`, `LITTER`, `WATER_SHORTAGE`, `AC_NOT_WORKING`) with resolution tracking.

8. **Emergency Escalation & SOS**:
   - Rapid emergency broadcast to Central Control Room, RPF, and medical teams with severity grading (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
   - Incident action trail and resolution logging.

---

## 2. Running Locally

The dashboard is completely standalone. You can run it via any local web server or open it directly in a browser:

```bash
# Option A: Python HTTP Server (Port 8080)
python -m http.server 8080 --directory "frontend/staff"

# Open in browser:
# http://localhost:8080/index.html
```

Or simply open `frontend/staff/index.html` directly in your browser.
