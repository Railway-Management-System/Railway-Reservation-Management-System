# Business Rules: Railway Reservation & Management System

This is the single source for how tickets, seats, fares, refunds, staff work and train disruptions behave. The database, backend, frontend and the AI coding tool (Antigravity) must all follow it. If another document disagrees, this one wins until the other is updated. Changes follow the process in section 19.

How to read it: every rule has an ID (BR-xx). **\[Railway\]** = taken from real Indian Railways practice. **\[Project\]** = our own choice, adjustable in the Settings table (section 15), so changing a number never needs a code change. **★** = new or changed since draft v1 (12 Oct 2026).

## 1. Scope and key terms

| Term               | Meaning                                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| PNR                | The 10-digit ticket number. One PNR holds 1 to 6 passengers.                                                                                  |
| Class              | Type of coach: 1A, 2A, 3A, SL, CC, EC, 2S.                                                                                                    |
| Quota              | A block of seats kept for a group: GENERAL, LADIES, TATKAL, SENIOR_CITIZEN, DIVYAANG.                                                         |
| Run                | One train leaving its first station on one date (the origin date). Seats, queues and charts belong to a run.                                  |
| Origin departure ★ | The scheduled departure of the train from its first station on the journey date. It is the one clock used for the chart and for refund slabs. |
| Stop sequence      | The numbered order of a train’s stops (1, 2, 3…).                                                                                             |
| Segment            | The stretch a passenger rides, from boarding stop to destination stop.                                                                        |
| CONFIRMED          | A real seat or berth is assigned.                                                                                                             |
| RAC                | Allowed to travel and share a side berth. Moves to a full berth when a seat frees up.                                                         |
| WAITING_LIST (WL)  | In a queue with no seat yet.                                                                                                                  |
| Hold               | Seats set aside for a user for 10 minutes while they fill in details and pay.                                                                 |
| Chart              | The final passenger list of a run. After it is made, online cancellation closes.                                                              |
| TDR                | Ticket Deposit Receipt: a refund claim for when the railway is at fault.                                                                      |
| Clerkage           | A small fixed charge kept when a RAC or waiting-list ticket is cancelled.                                                                     |
| Counter booking ★  | A ticket booked by a staff member at a station counter for a walk-in passenger.                                                               |
| Adult              | A passenger aged 18 or more.                                                                                                                  |

**Out of scope for version 1:** food ordering (removed from every document and from the ER diagram), unreserved and season tickets, luggage, ticket transfers, SMS and email, Premium Tatkal as a separate quota (a price switch is described in BR-F11), defence and foreign-tourist quotas, escort concessions, student and medical concessions, child fares. Children are booked as normal passengers at full fare. No real money is ever charged: payments use Razorpay TEST mode only (BR-B7).

## 2. Quotas and eligibility

Every booking uses exactly one quota. Seat counts are tracked separately for each quota on each run and class.

| Quota                      | Who can use it                                                                                        | Extra rules                                                                                                                      | Concession allowed | Seat share ★                                                          |
|----------------------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|--------------------|-----------------------------------------------------------------------|
| GENERAL (BR-Q1)            | Anyone. Default.                                                                                      | None.                                                                                                                            | Yes                | Everything left after the other quotas                                |
| LADIES (BR-Q2) \[Project\] | Every passenger aged 12 or more must be FEMALE. Children under 12 of any gender may travel with them. | Gender is checked at booking.                                                                                                    | Yes                | 10% of the class seats                                                |
| TATKAL (BR-Q3)             | Anyone with an Aadhaar-verified account.                                                              | Opens one day before the train leaves its origin. Maximum 4 passengers per PNR. Confirmed tickets get no refund on cancellation. | No \[Project\]     | 10% of the class seats                                                |
| SENIOR_CITIZEN (BR-Q4)     | Men aged 60 or more. Women aged 45 or more ★.                                                         | Works as a lower-berth quota (section 4).                                                                                        | Yes                | Lower-berth block: SL 6, 3A 4, 2A 3 per coach. None in other classes. |
| DIVYAANG (BR-Q5)           | Passengers with disability proof (section 7).                                                         | Uses the reserved berth block for persons with disabilities.                                                                     | Yes                | Per train: SL 4, 3A 4, CC 4, 2S 4 seats. None in other classes.       |

- BR-Q6 \[Railway\]: Tatkal needs an Aadhaar-verified account and an OTP check on each Tatkal booking (in force since July 2025).

- BR-Q7 \[Project\]: Tatkal opens at 10:00 for AC classes and 11:00 for non-AC classes, on the day before the origin departure.

- BR-Q8 \[Project\]: We do not store whether a woman is pregnant, so that part of the lower-berth rule is left out.

- BR-Q9: A passenger who does not meet a quota’s condition is rejected with QUOTA_NOT_ELIGIBLE.

- BR-Q10 ★ \[Project\] Seat share: for each run and class, TATKAL = 10% and LADIES = 10% of the class seats (rounded to the nearest whole seat), SENIOR_CITIZEN and DIVYAANG are the reserved blocks above, and GENERAL gets the rest. Example: 8 SL coaches = 576 seats: TATKAL 58, LADIES 58, SENIOR_CITIZEN 48, DIVYAANG 4, GENERAL 408. Quotas are counts of seats, not named seats, except the two reserved blocks, which are physical seats.

- BR-Q11 ★ \[Railway\]: At chart time, unsold seats in LADIES, TATKAL, SENIOR_CITIZEN and DIVYAANG move to GENERAL, and GENERAL promotion runs on them (section 5).

- BR-Q12 ★: RAC and waiting list exist only for GENERAL and TATKAL. Other quotas give CONFIRMED or “not available”.

- BR-Q13 ★ Quota fallback: if LADIES, SENIOR_CITIZEN or DIVYAANG has no seat for the whole group, the system does not simply fail. It shows a notice and the user chooses CONTINUE or CANCEL. The notice must say: “No seats are left in the \[quota\] quota for this train and date. We can book you in the General quota instead. Your seat may not be your preferred one (for example an upper berth or a different coach), and General seats go first-come-first-served, so you may get RAC or Waiting List instead of a confirmed seat. Fare, refund and cancellation rules stay the same.” The notice also lists the status each passenger would get (CONFIRMED, RAC or WL). On CONTINUE the booking quota becomes GENERAL and the original request is saved as requested_quota. Concession and the automatic lower berth for seniors still apply. No fallback is offered for TATKAL.

- BR-Q14 ★: Gender OTHER follows the male age thresholds (senior at 60 or more) and is not eligible for LADIES.

- BR-Q15 ★: Every PNR must include at least one adult. Otherwise the booking is rejected with NO_ADULT_PASSENGER. (Also state this as a safety precaution in the presentation.)

## 3. Booking lifecycle

A booking moves through search, hold, creation, payment and confirmation. The database decides each passenger’s status inside one all-or-nothing operation, so two people can never get the same seat.

| ID                    | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-B1 \[Project\]     | Search needs a source station, a destination station and a boarding date within the booking window (7 days ahead, a setting).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| BR-B1a ★ \[Project\]  | Running days: each train has running days (MON to SUN) in the train data. A running day is a day the train leaves its origin station. The passenger picks the date they board at their own boarding station. The system subtracts that stop’s day_offset to find the origin date. If the train does not run on that origin date’s weekday, the result is TRAIN_NOT_RUNNING and the train is hidden from search. Every arrival and departure date-time at a stop = origin date + day_offset days + the stop’s clock time. A run is identified by its origin date, and the e-ticket shows both the boarding date and the origin date. Example: a train leaves Mumbai on Monday evening and reaches Surat early on Tuesday. A passenger boarding at Surat picks Tuesday, and the system maps it to Monday’s run. |
| BR-B2 ★ \[Project\]   | The number of passengers (1 to 6, or 4 for Tatkal) is chosen together with class and quota, before Step 3. The seat hold starts when the user enters Passenger Details (Step 3) and lasts 10 minutes. It reserves that many seats, as CONFIRMED first, then RAC, then WL, the same way booking would decide. One active hold per user.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| BR-B3 \[Project\]     | Every passenger needs name, age, gender and an ID proof type and reference. At least one adult (BR-Q15).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| BR-B4                 | On Create Booking the system locks the availability row for that run, class and quota, decides CONFIRMED, RAC or WAITING_LIST for each passenger (section 5), reserves the counts, creates a unique 10-digit PNR and sets the booking to PAYMENT_PENDING.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-B5                 | Rejection codes: SEAT_NOT_AVAILABLE, WAITING_LIST_FULL, NOT_ALL_CONFIRMED, HOLD_EXPIRED, TRAIN_NOT_RUNNING, QUOTA_NOT_ELIGIBLE, CONCESSION_PROOF_REQUIRED, NO_ADULT_PASSENGER ★, BERTH_PREFERENCE_NOT_MET ★, MONTHLY_LIMIT_EXCEEDED ★, CHART_PREPARED ★.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| BR-B6                 | If the user ticked “book only if confirmed” and any passenger would be RAC or WL, the whole booking is rejected with NOT_ALL_CONFIRMED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BR-B6a ★ \[Project\]  | Berth condition: at Step 3 the user can tick “book only if my preferred berth type is given”. It works in classes with berths (SL, 3A, 2A, 1A). If any passenger would not get their preferred berth type (LOWER, MIDDLE, UPPER, SIDE_LOWER or SIDE_UPPER), or would be RAC or WL, the whole booking is rejected with BERTH_PREFERENCE_NOT_MET and every reserved count is released. Eligible senior citizens count as preferring LOWER (BR-S2). It can be combined with BR-B6.                                                                                                                                                                                                                                                                                                                               |
| BR-B7 ★               | Payment uses Razorpay in TEST mode (no real money). The backend creates a Razorpay order for the exact total fare. A checkout window opens. On success Razorpay returns a payment ID and a signature. The backend checks the signature, and only then sets the payment to SUCCESS. Payment modes stored: CREDIT_CARD, DEBIT_CARD, UPI, NET_BANKING, and CASH for counter bookings only. Raw card details are never stored. The raw gateway reply may be kept in MongoDB.                                                                                                                                                                                                                                                                                                                                      |
| BR-B8                 | On payment SUCCESS the system assigns coach and seat to every CONFIRMED and RAC passenger (section 4), stores queue positions (section 5), makes the e-ticket and sends a notification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BR-B9                 | On payment FAILED, or when the hold expires, the booking becomes FAILED and all reserved counts are released. The user may retry until the timer ends. Each attempt is its own payment record. A payment that arrives after expiry follows BR-B14.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| BR-B10                | Booking status equals its weakest passenger status, in the order CONFIRMED, RAC, WAITING_LIST.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BR-B11 \[Project\]    | A passenger may change the boarding station until 30 minutes before the scheduled departure from that station, to a later stop on the same journey. The fare does not change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| BR-B12 ★              | The chart is made 8 hours before the origin departure of the run. From then, online cancellation is closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-B12a ★ \[Project\] | Chart lockout: from chart time, no new booking can be created for that run (error CHART_PREPARED). This includes counter bookings and Tatkal. Every hold still running for that run is cancelled, and a payment that arrives afterwards follows BR-B14. Real railways keep a short “current booking” window after the chart; version 1 skips it. At chart time the system also saves a chart snapshot: one row per passenger with PNR, passenger number, coach, seat, berth, status, boarding and destination stops and a concession flag. The snapshot is written once and never changed. Ticket collectors and the chart screen read it as the starting passenger list. Later boarding and no-show marks are stored on the reservation, not in the snapshot.                                                |
| BR-B13 ★              | Every money amount is rounded to 2 decimals, half up, per passenger line.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-B14 ★ \[Project\]  | Payment without a ticket: a payment can succeed after the hold expired, after the booking became FAILED, or when seats cannot be assigned for any other reason (for example a system error). Then the booking stays FAILED, no seat is assigned, and the full amount paid, including insurance because no ticket was issued, is refunded automatically to the original payment. The refund has reason PAYMENT_AFTER_EXPIRY and status PENDING, then PROCESSED, and the user gets a STATUS_UPDATE notification. A Razorpay payment ID is processed only once: a repeated confirmation (duplicate callback or double click) is ignored and never creates a second ticket or a second refund.                                                                                                                    |
| BR-B15 ★ \[Project\]  | Monthly ticket limit: a user can create at most 12 tickets (PNRs) in one calendar month, or 24 if the account is Aadhaar-verified (modelled on IRCTC practice; both numbers are settings). The count is by booking date, includes tickets cancelled later, and leaves out FAILED bookings. The shared COUNTER_WALKIN account is exempt. It is checked when the hold starts and again on Create Booking, before any seat is reserved. Error code: MONTHLY_LIMIT_EXCEEDED.                                                                                                                                                                                                                                                                                                                                      |
| BR-B16 ★ \[Project\]  | Chart processing order: at chart time the system works on each run as one all-or-nothing operation, in this order: (1) lock new bookings and cancel running holds (BR-B12a); (2) move unsold LADIES, TATKAL, SENIOR_CITIZEN and DIVYAANG seats to GENERAL and promote (BR-Q11); (3) auto-upgrade ticked passengers in booking order, each freed seat promoting in its old class (BR-S6); (4) cancel and fully refund passengers still waitlisted (BR-W8); (5) save the chart snapshot.                                                                                                                                                                                                                                                                                                                        |

Flow: search → choose class, quota and passenger count → Passenger Details (hold starts, 10 minutes) → Create Booking → PAYMENT_PENDING → pay in the Razorpay test window → success: assign seats, e-ticket, notification; failure or timeout: release everything.

## 4. Seat and berth allotment

**Seat maps (BR-S1 \[Project\]).**

| Class | Seats per coach | Seat types used                              | RAC offered |
|-------|-----------------|----------------------------------------------|-------------|
| SL    | 72              | LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER | Yes         |
| 3A    | 64              | LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER | Yes         |
| 2A    | 48              | LOWER, UPPER, SIDE_LOWER, SIDE_UPPER         | Yes         |
| 1A    | 24              | LOWER, UPPER                                 | No          |
| CC    | 78              | WINDOW, AISLE, NO_BERTH                      | No          |
| EC    | 56              | WINDOW, AISLE, NO_BERTH                      | No          |
| 2S    | 108             | WINDOW, AISLE, NO_BERTH                      | No          |

**Train layouts ★ (BR-S1a \[Project\]).** Which classes a train has and how many coaches of each:

| Train type   | Classes and coaches                    | In the current data                                              |
|--------------|----------------------------------------|------------------------------------------------------------------|
| RAJDHANI     | 1A × 1, 2A × 4, 3A × 10                | Yes                                                              |
| SHATABDI     | EC × 1, CC × 10                        | Yes                                                              |
| DURONTO ★    | 1A × 1, 2A × 2, 3A × 6, SL × 6         | Yes                                                              |
| EXPRESS      | 1A × 1, 2A × 2, 3A × 4, SL × 8, 2S × 2 | Only if a train stays EXPRESS after the type review (section 17) |
| VANDE_BHARAT | EC × 2, CC × 14                        | No. Kept for trains an admin may add later.                      |

No train in the current data has 2S, so the 2S rules stay defined but unused.

**Order of allotment (BR-S2).** Disability quota first, then senior citizens, then women aged 45 or more, then everyone else by booking order. For each passenger:

- Eligible passengers (men 60+, women 45+, OTHER 60+) get a LOWER berth automatically, even if they did not ask, when one is free \[Railway\].

- Otherwise the passenger’s berth preference is tried, then any free seat in the class.

- Passengers on one PNR go in the same coach where possible.

- A seat must be free for the passenger’s whole segment.

**Reserved berths (BR-S3 \[Railway\], numbers \[Project\]).** Lower-berth block per coach for senior citizens and women 45+: SL 6, 3A 4, 2A 3. Disability block per train: SL 4 berths (2 lower, 2 middle), 3A 4 berths (2 lower, 2 middle), 4 seats in CC or 2S. Both blocks open to everyone at chart time. Lower berths that fall vacant during the journey go first to senior citizens, persons with disabilities and pregnant women holding middle or upper berths (the ticket collector applies this).

**Seat sharing (BR-S4).** One seat on one date can be sold to two passengers only if their segments do not overlap. Two segments overlap when max(StartA, StartB) is less than min(EndA, EndB), using stop-sequence numbers. Stops 1 to 3 and 3 to 5 can share a seat, because 3 is not less than 3.

**RAC berth sharing ★ (BR-S5).** The only allowed overlap: up to 2 RAC passengers may share one SIDE_LOWER berth even if their segments overlap. A promoted RAC passenger moves to a full berth.

**Auto-upgrade (BR-S6 \[Project\]).** If a passenger ticked auto-upgrade, at chart time they move one class up (SL→3A, 3A→2A, 2A→1A, CC→EC) when a berth is free for their whole segment. No extra charge. Served in booking order. The e-ticket and notification show the new coach. The seat the passenger leaves in the old class counts as freed and starts promotion in that class (BR-W4) in the same operation ★.

## 5. RAC and waiting list

| ID                | Rule                                                                                                                                                                                                                                                                                                                                                                          |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-W1 ★           | A passenger gets CONFIRMED if a seat of their quota is free for the whole segment. Otherwise, for GENERAL and TATKAL only, RAC if the class offers RAC and RAC slots are left. Otherwise WAITING_LIST if slots are left. Otherwise the booking is rejected with WAITING_LIST_FULL (or SEAT_NOT_AVAILABLE for the other quotas, which triggers the fallback notice of BR-Q13). |
| BR-W2 \[Project\] | RAC slots are 10% and waiting-list slots 25% of the confirmed seats of that run, class and quota (rounded half up). Example: GENERAL SL with 408 seats: RAC 41, WL 102. In classes without RAC, a waiting-list passenger moves straight to CONFIRMED.                                                                                                                         |
| BR-W3             | Queue positions (RAC/1, WL/3) are given when payment succeeds, in order of payment time. A failed or expired booking never takes a position, so there are no gaps.                                                                                                                                                                                                            |
| BR-W4             | A promotion starts when a CONFIRMED or RAC passenger cancels, when staff mark a no-show, when a ticket collector releases a berth, when unused quota seats move to GENERAL at chart time, or when an auto-upgrade frees a seat ★.                                                                                                                                             |
| BR-W5             | A freed seat goes to the lowest-numbered RAC passenger of the same run, class and quota whose segment fits the seat’s free stops. That passenger becomes CONFIRMED with that seat.                                                                                                                                                                                            |
| BR-W6             | The RAC slot that opens goes to the lowest-numbered waiting-list passenger, who becomes RAC. All later positions move up by one.                                                                                                                                                                                                                                              |
| BR-W7             | If a waiting-list passenger cancels, only the positions behind them move up.                                                                                                                                                                                                                                                                                                  |
| BR-W8 \[Railway\] | At chart time, passengers still waitlisted are cancelled automatically and refunded in full (insurance excluded) to the original payment. Passengers still on RAC may travel and share a berth.                                                                                                                                                                               |
| BR-W9             | Every promotion creates a STATUS_UPDATE notification for the booking owner.                                                                                                                                                                                                                                                                                                   |

Status lifecycle: WAITING_LIST → RAC → CONFIRMED → BOARDED or NO_SHOW. A passenger can cancel from any of the three waiting statuses, giving CANCELLED.

## 6. Fare calculation

Fare is worked out per passenger from the stretch they ride, using the fare tables below, which live in the database (never hard-coded).

| ID                | Part               | How it is worked out                                                                                                                |
|-------------------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| BR-F1             | Distance           | Distance from origin of the destination stop minus that of the boarding stop. At least 100 km is charged (setting).                 |
| BR-F2 \[Project\] | Base fare          | Distance × the class rate per km. The rate is picked by the distance slab the whole trip falls in (longer trips cost less per km).  |
| BR-F3 \[Railway\] | Reservation charge | Flat amount per passenger, per class.                                                                                               |
| BR-F4 \[Project\] | Superfast charge   | Flat amount per passenger on RAJDHANI, SHATABDI and DURONTO trains (and VANDE_BHARAT if such trains are added).                     |
| BR-F5 \[Project\] | Tatkal charge      | Percentage of base fare when quota is TATKAL: 30% for AC classes, 10% for non-AC.                                                   |
| BR-F6             | Concession         | Percentage of the base fare only (section 7).                                                                                       |
| BR-F7             | Taxable amount     | Base fare − concession + reservation + superfast + Tatkal + dynamic surcharge (only when BR-F11 is switched on).                    |
| BR-F8 \[Railway\] | GST                | 5% of the taxable amount for AC classes (1A, 2A, 3A, CC, EC). None for SL and 2S.                                                   |
| BR-F9 \[Project\] | Insurance          | Optional flat premium 0.45 per passenger. Not taxed. Not refunded on cancellation; the only exception is BR-B14 (no ticket issued). |
| BR-F10            | Total fare         | Taxable + GST + insurance, rounded to 2 decimals.                                                                                   |

The fare is stored per passenger (base, concession, reservation, superfast, Tatkal, GST, insurance, total), because partial cancellation needs each passenger’s own amount.

**Base rate per km ★ (BR-F2a \[Project\]).** These are project values in realistic ranges, not official tariffs. Edit them in the fare table.

| Class | Up to 300 km | 301–700 km | 701–1300 km | Over 1300 km |
|-------|--------------|------------|-------------|--------------|
| 2S    | 0.55         | 0.48       | 0.42        | 0.38         |
| SL    | 0.85         | 0.72       | 0.62        | 0.55         |
| 3A    | 2.20         | 1.90       | 1.55        | 1.34         |
| 2A    | 3.20         | 2.75       | 2.25        | 1.95         |
| 1A    | 5.40         | 4.60       | 3.80        | 3.30         |
| CC    | 1.90         | 1.65       | 1.40        | 1.20         |
| EC    | 3.60         | 3.15       | 2.70        | 2.35         |

**Flat charges per passenger ★ (BR-F3a, BR-F4a).** Reservation: 2S 15, SL 20, 3A 40, 2A 50, 1A 60, CC 40, EC 60. Superfast (only on RAJDHANI, SHATABDI, DURONTO; also VANDE_BHARAT if added): 2S 15, SL 30, 3A 45, 2A 45, 1A 75, CC 45, EC 75. The first five reservation and superfast values match current Indian Railways charges; CC and EC are set by us.

**Worked examples** (class 3A, base fare 1,850, reservation 40, superfast 45):

| Case           | Concession | Tatkal | Taxable  | GST    | Insurance | Total    |
|----------------|------------|--------|----------|--------|-----------|----------|
| General        | 0          | 0      | 1,935.00 | 96.75  | 0.45      | 2,032.20 |
| Tatkal         | 0          | 555.00 | 2,490.00 | 124.50 | 0.45      | 2,614.95 |
| Divyangjan 75% | 1,387.50   | 0      | 547.50   | 27.38  | 0.45      | 575.33   |

BR-F11 ★ \[Project\] Dynamic Tatkal fare (optional, OFF by default, setting DYNAMIC_FARE_ENABLED). When switched on, a TATKAL booking pays a surcharge once a class is nearly full: if at least 80% of the confirmed seats of that run and class are already booked at the moment of Create Booking, the base fare is multiplied by 1.5 for TATKAL passengers, so the dynamic surcharge = base fare × 0.5, added to the taxable amount. It applies only to TATKAL, is worked out once per booking, and is stored on each passenger’s fare line, so refunds always use what was actually charged. All worked examples in this section assume it is OFF.

## 7. Concessions

Only the Divyangjan concession is active. The senior citizen concession is kept in the rules table as switched off (withdrawn by the railway in March 2020).

| Category                     | Status             | Discount on base fare                                                                                                                                       | Proof                                                 |
|------------------------------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| DIVYAANG (BR-C1) \[Railway\] | Active             | 75% in SL, 2S, 3A, CC. 50% in 1A, 2A. None in EC. ★ On RAJDHANI, SHATABDI and DURONTO trains (and VANDE_BHARAT if added), 3A and CC get 25% instead of 75%. | RAILWAY_DIVYANGJAN_ID, UDID or CONCESSION_CERTIFICATE |
| SENIOR_CITIZEN (BR-C2)       | Inactive (setting) | Was 40% men, 50% women. Now 0%.                                                                                                                             | Age proof, only if it returns                         |
| STUDENT, MEDICAL (BR-C3)     | Not in version 1   | Treated as NONE.                                                                                                                                            | None                                                  |

- BR-C4: A passenger has one concession type. It reduces the base fare only. Reservation, superfast and Tatkal charges stay in full.

- BR-C5 \[Project\]: No concession on TATKAL bookings.

- BR-C6: At booking the passenger picks a concession and gives proof type and reference. Without it: CONCESSION_PROOF_REQUIRED.

- BR-C7: On the train, the ticket collector records the proof check as VALID, INVALID or MISMATCH.

- BR-C8 \[Railway\]: Seniors keep the automatic lower-berth benefit even with the fare concession off.

- BR-C9: Turning a concession on or off is an admin change and is written to the audit log.

- BR-C10 ★: Saved passenger records keep disability type and proof only. The concession itself is chosen per booking, so it is never stored as a permanent label on a person.

## 8. Cancellation and refunds

Refund = fare paid minus cancellation charge, returned to the same payment. A database function works out the charge from the hours left before the **origin departure** ★ (BR-R1).

| Time before origin departure | Deduction from fare                       |
|------------------------------|-------------------------------------------|
| More than 72 hours           | Flat minimum only                         |
| 72 to 24 hours               | 25% (not less than the flat minimum)      |
| 24 to 8 hours                | 50% (not less than the flat minimum)      |
| Less than 8 hours            | No online cancel (chart made). No refund. |

The charge is the larger of the flat minimum and the percentage. Flat minimums per passenger (BR-R2 \[Project\]): 1A and EC 240, 2A 200, 3A and CC 180, SL 120, 2S 60.

| ID                | Rule                                                                                                                                                                                                                      |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-R3             | Refund basis is the passenger’s own fare line (base after concession, plus reservation, superfast, Tatkal and GST). Insurance is not refunded on cancellation (the only exception is BR-B14, where no ticket was issued). |
| BR-R4             | Cancelling is per passenger. Cancelling the whole PNR cancels all its passengers. The rest keep their seats.                                                                                                              |
| BR-R5 \[Railway\] | RAC and waiting-list passengers who cancel before the chart get a full refund minus clerkage (60 per passenger, a setting).                                                                                               |
| BR-R6 \[Railway\] | Confirmed Tatkal tickets get no refund on voluntary cancellation. A Tatkal waiting-list ticket that never confirms is refunded in full automatically.                                                                     |
| BR-R7 \[Railway\] | After the chart, a passenger cannot cancel online. A CONFIRMED passenger who does not travel gets no refund, except through a TDR for a railway fault (section 9).                                                        |
| BR-R8             | Every cancellation creates a cancellation record and a refund record pointing to the original payment and its gateway transaction ID. Refund status: PENDING, then PROCESSED.                                             |
| BR-R9             | Every cancel runs the promotion rules (section 5) in the same operation.                                                                                                                                                  |
| BR-R10 ★          | A cancelled train refunds everyone in full automatically, without slabs. “Full” excludes insurance.                                                                                                                       |
| BR-R11 ★          | Counter-booked tickets are cancelled at the counter by staff, and the refund is paid back as CASH. The same slabs and chart closing apply.                                                                                |

**Worked example.** A 3A fare of 2,031.75 (insurance excluded) cancelled 30 hours before origin departure falls in the 25% slab: 507.94 is deducted (above the flat minimum of 180), so 1,523.81 is refunded.

## 9. TDR (Ticket Deposit Receipt)

A TDR is a refund claim for when the **railway is at fault** ★. A passenger who simply does not travel after the chart has no TDR right (BR-R7). The passenger files it, an admin reviews it, and an approved refund returns to the original payment.

| Reason code                            | When it applies                                                                                | Deadline                          | Proof                       | Refund                             |
|----------------------------------------|------------------------------------------------------------------------------------------------|-----------------------------------|-----------------------------|------------------------------------|
| TRAIN_DELAYED_OVER_3_HOURS \[Railway\] | Train is over 180 minutes late at the boarding station and nobody on the PNR travelled         | Before the train actually departs | System checks delay_minutes | Full fare                          |
| TRAIN_DIVERTED \[Railway\]             | Route changed and the passenger does not want to travel, or their station is off the new route | Before actual departure           | System checks schedule note | Full fare                          |
| CLASS_DOWNGRADED \[Railway\]           | Moved to a lower class and does not want to travel                                             | 72 hours after actual arrival     | TC certificate              | Full fare                          |
| AC_FAILURE \[Railway\]                 | AC not working in an AC coach                                                                  | 72 hours after actual arrival     | TC certificate              | Fare difference to the lower class |
| COACH_NOT_ATTACHED \[Railway\]         | Booked coach was missing or taken out of service                                               | 72 hours after actual arrival     | TC certificate              | Full fare                          |
| TRAIN_TERMINATED_SHORT \[Railway\]     | Train ended before the destination                                                             | 72 hours after actual arrival     | TC certificate              | Fare for the unused stretch        |

- BR-T2: A cancelled train needs no TDR (BR-R10).

- BR-T3 ★: The booking owner can file for one or more passengers on a PNR. The system creates one TDR record per passenger. A passenger can have only one open TDR.

- BR-T4: Statuses: FILED, UNDER_REVIEW, APPROVED, REJECTED, REFUND_PROCESSED.

- BR-T5: The filing screen warns that a false claim can lead to rejection and account suspension.

- BR-T6: A passenger in a delay TDR cannot be marked BOARDED by staff.

- BR-T7: The admin approves with a refund amount no higher than the fare paid. Approval or rejection is written to the audit log with old and new values.

- BR-T8: An approved TDR creates a refund record pointing to the original payment. The status becomes REFUND_PROCESSED and the passenger is notified.

- BR-T9 ★: “Missed connection” is not a TDR reason in version 1.

## 10. Delays, cancellations and weather

Weather is not a separate rule. Fog, floods or heavy rain show up as a train being delayed, diverted or cancelled, and the system reacts to that schedule status. Delay minutes live in the run’s schedule record in MySQL ★, and are copied to MongoDB for the live status feed.

| Event                              | What the system does automatically                                                                     | What the passenger can do                                                              |
|------------------------------------|--------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Train cancelled (status CANCELLED) | Cancels every passenger on the run, frees seats, refunds the full fare (BR-R10), notifies. \[Railway\] | Nothing.                                                                               |
| Train delayed                      | Shows the delay and notifies booked passengers at 30 minutes or more.                                  | If the delay at the boarding station is over 180 minutes, file a TDR before departure. |
| Train diverted                     | Admin or staff records it on the schedule. Passengers are notified.                                    | File a TDR (TRAIN_DIVERTED) if they do not want to travel.                             |
| Train ends short                   | Staff record it.                                                                                       | File a TDR with a certificate.                                                         |
| Platform changed                   | Notification PLATFORM_CHANGE.                                                                          | None.                                                                                  |
| Emergency                          | Notification EMERGENCY to staff on that train and all admins.                                          | None.                                                                                  |

- BR-D1: Only staff on duty for that train and admins can change a schedule’s status or delay. Every change is logged with user and time.

- BR-D2: A delay never changes fare or seat. Only a TDR or a cancelled train changes money.

- BR-D3: A train-cancel refund is full and does not use the slabs.

## 11. Staff and ticket collector rules

Staff act only on the duty they are assigned to, and every action is stamped with staff ID and time. Duty types ★: TRAIN_DUTY, STATION_DUTY, COUNTER_DUTY, MAINTENANCE_DUTY.

| ID                 | Rule                                                                                                                                                                                             |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-ST1             | Only an admin creates staff accounts. Staff log in with their employee ID.                                                                                                                       |
| BR-ST2 \[Project\] | A staff member sees only their current duty: train, date and coaches; or station and platform; or counter; or maintenance tasks, with shift times.                                               |
| BR-ST3             | ID check: the collector compares the passenger’s ID with the ticket and records VALID, INVALID or MISMATCH. For concession passengers the concession proof is checked too.                       |
| BR-ST4             | Boarding: only CONFIRMED and RAC passengers on the assigned run can be marked BOARDED or NO_SHOW. A passenger in a delay TDR cannot be marked BOARDED.                                           |
| BR-ST5             | NO_SHOW frees that seat for the passenger’s remaining stops and starts promotion (section 5). No refund.                                                                                         |
| BR-ST6             | Vacant lower berths are offered first to senior citizens, persons with disabilities and pregnant women holding middle or upper berths.                                                           |
| BR-ST7             | Fines: the collector enters passenger name, ID reference, reason, amount and PAID or UNPAID. Reasons include TICKETLESS_TRAVEL and UNAUTHORIZED_CLASS. Minimum and maximum amounts are settings. |
| BR-ST8             | Reports: delay in minutes, platform number, crowd level (LOW, MODERATE, HIGH, OVERCROWDED), cleanliness issues, and incidents with severity LOW, MEDIUM, HIGH or CRITICAL.                       |
| BR-ST9             | A HIGH or CRITICAL incident immediately notifies all admins.                                                                                                                                     |

## 12. Counter booking ★

Staff on COUNTER_DUTY can book tickets for walk-in passengers at a station counter.

| ID     | Rule                                                                                                                                                                                                                                                  |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-CB1 | Only staff with COUNTER_DUTY in the current shift can create counter bookings. The booking stores channel = COUNTER and the staff ID.                                                                                                                 |
| BR-CB2 | Counter bookings follow every online rule: quotas, fare, 10-minute hold, 1 to 6 passengers, RAC and waiting list, chart closing and error codes. No rule is relaxed.                                                                                  |
| BR-CB3 | A walk-in passenger without an account is booked under the shared system account COUNTER_WALKIN. If the passenger has an account, staff can book under it. No in-app notification is sent for COUNTER_WALKIN bookings; the ticket is printed instead. |
| BR-CB4 | Payment at the counter is recorded by staff as CASH, UPI, CREDIT_CARD or DEBIT_CARD. There is no Razorpay window and no gateway ID. The payment becomes SUCCESS when staff confirm the money was received.                                            |
| BR-CB5 | Tatkal at the counter follows BR-Q3 and BR-Q7. Staff enter an Aadhaar ID proof for one passenger and simulate the OTP step.                                                                                                                           |
| BR-CB6 | Cancellation and refund of counter tickets follow BR-R11 (at the counter, refund in cash).                                                                                                                                                            |
| BR-CB7 | At the end of a shift, each clerk sees the number of counter bookings and the cash collected. The totals are written to the audit log. Admins can see all counters.                                                                                   |
| BR-CB8 | A counter booking can be changed or cancelled only by counter staff of the same station, or by an admin (BR-A4).                                                                                                                                      |

## 13. Maintenance ★

Maintenance keeps coaches and platforms in working order and links to passenger rights when a coach cannot be used.

| ID    | Rule                                                                                                                                                                                                                              |
|-------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-M1 | Staff on MAINTENANCE_DUTY and admins create maintenance tasks. Each task is about exactly one coach or exactly one platform.                                                                                                      |
| BR-M2 | Task types: CLEANING, REPAIR, AC_SERVICE, INSPECTION, SAFETY_CHECK. Status moves OPEN, IN_PROGRESS, COMPLETED (or CANCELLED). Every change is stamped with staff ID and time.                                                     |
| BR-M3 | An admin can mark a coach OUT_OF_SERVICE for a run. Its passengers are notified and may file a TDR with reason COACH_NOT_ATTACHED. The admin may also move them to free seats of the same class using a booking override (BR-A4). |
| BR-M4 | A coach cannot return to service until its REPAIR or AC_SERVICE task is COMPLETED.                                                                                                                                                |
| BR-M5 | A platform with an open task is shown as unavailable. The admin gets a warning when assigning it to a route stop.                                                                                                                 |
| BR-M6 | Maintenance records can be added and updated but never deleted. Changes are written to the audit log.                                                                                                                             |

## 14. Admin rules and notifications

| ID      | Rule                                                                                                                                                                                           |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-A1   | Admins manage stations, platforms, trains, routes, schedules, coaches, seats, fares, quotas, concession rules, refund rules, settings and staff accounts.                                      |
| BR-A2   | A change to fares, concessions, refund slabs or settings applies only to bookings and cancellations made after the change. Each booking keeps the fare breakdown it was charged.               |
| BR-A3   | A train or station with future bookings cannot be deleted. It can be set to CANCELLED or inactive instead.                                                                                     |
| BR-A4   | An admin can override or cancel any booking. A reason is required. Normal refund rules apply unless the admin waives the charge.                                                               |
| BR-A5   | A suspended passenger cannot log in or book. Existing future bookings stay valid.                                                                                                              |
| BR-A6   | Admins review TDR claims (section 9).                                                                                                                                                          |
| BR-A7   | The audit log can be added to but never edited or deleted. Each entry holds user, action, entity type, entity ID, old value, new value and time.                                               |
| BR-A8   | Any change to a fare, concession or refund rule writes an audit entry automatically through a database trigger.                                                                                |
| BR-A9 ★ | A route stop’s platform number can never be higher than the platform count of its station. If data disagrees, raise the station’s platform count rather than dropping a platform a train uses. |

**Notifications (BR-N1 ★).** In-app only, stored in MongoDB. No SMS or email in version 1.

| Event                                                                                            | Who gets it                        | Type                 |
|--------------------------------------------------------------------------------------------------|------------------------------------|----------------------|
| Booking confirmed, RAC or waiting list                                                           | Booking owner                      | BOOKING_CONFIRMATION |
| Promotion, chart cancellation, auto-upgrade, cancellation or refund processed, TDR status change | Booking owner                      | STATUS_UPDATE        |
| Train cancelled                                                                                  | Owners of all bookings on the run  | STATUS_UPDATE        |
| Train delayed 30 minutes or more                                                                 | Owners of all bookings on the run  | DELAY                |
| Platform change                                                                                  | Owners of bookings on the run      | PLATFORM_CHANGE      |
| Emergency incident                                                                               | Staff on that train and all admins | EMERGENCY            |
| Coach out of service                                                                             | Owners of bookings in that coach   | STATUS_UPDATE        |

## 15. Settings table

Every adjustable number lives in one settings table in the database. Code reads these values and never hard-codes them. Fare tables (section 6) have their own tables.

| Setting                                        | Default                                                             | Used in      |
|------------------------------------------------|---------------------------------------------------------------------|--------------|
| HOLD_MINUTES                                   | 10                                                                  | BR-B2        |
| BOOKING_WINDOW_DAYS                            | 7                                                                   | BR-B1        |
| MAX_PASSENGERS_PER_PNR / MAX_PASSENGERS_TATKAL | 6 / 4                                                               | BR-B3, BR-Q3 |
| TATKAL_OPEN_TIME_AC / \_NON_AC                 | 10:00 / 11:00, one day before origin departure                      | BR-Q7        |
| TATKAL_PERCENT_AC / \_NON_AC                   | 30 / 10                                                             | BR-F5        |
| QUOTA_SHARE_PERCENT                            | TATKAL 10, LADIES 10                                                | BR-Q10       |
| RAC_WL_QUOTAS                                  | GENERAL, TATKAL                                                     | BR-Q12       |
| RAC_PERCENT / WL_PERCENT                       | 10 / 25 of the quota’s seats                                        | BR-W2        |
| CHART_HOURS_BEFORE_ORIGIN_DEPARTURE            | 8                                                                   | BR-B12       |
| BOARDING_CHANGE_MINUTES_BEFORE                 | 30                                                                  | BR-B11       |
| LOWER_BERTH_BLOCK_PER_COACH                    | SL 6, 3A 4, 2A 3                                                    | BR-S3        |
| PWD_BLOCK_PER_TRAIN                            | SL 4, 3A 4, CC 4, 2S 4                                              | BR-S3        |
| TRAIN_LAYOUTS                                  | As in section 4                                                     | BR-S1a       |
| MIN_CHARGEABLE_KM                              | 100                                                                 | BR-F1        |
| GST_PERCENT_AC                                 | 5                                                                   | BR-F8        |
| INSURANCE_PREMIUM                              | 0.45 per passenger                                                  | BR-F9        |
| REFUND_SLAB_HOURS / PERCENT                    | 72, 24, 8 / 25, 50                                                  | BR-R1        |
| FLAT_MIN_CHARGE                                | 1A and EC 240, 2A 200, 3A and CC 180, SL 120, 2S 60                 | BR-R2        |
| CLERKAGE_PER_PASSENGER                         | 60                                                                  | BR-R5        |
| DELAY_NOTIFY_MINUTES                           | 30                                                                  | BR-D1        |
| TDR_DELAY_THRESHOLD_MINUTES                    | 180                                                                 | BR-T1        |
| TDR_CERTIFICATE_DEADLINE_HOURS                 | 72                                                                  | BR-T1        |
| CONCESSION_SENIOR_ACTIVE                       | false                                                               | BR-C2        |
| DYNAMIC_FARE_ENABLED                           | false                                                               | BR-F11       |
| RAZORPAY_MODE                                  | TEST (never LIVE)                                                   | BR-B7        |
| FINE_MIN / FINE_MAX                            | Set by admin                                                        | BR-ST7       |
| SUPERFAST_TRAIN_TYPES ★                        | RAJDHANI, SHATABDI, DURONTO                                         | BR-F4        |
| CONCESSION_25_TRAIN_TYPES ★                    | RAJDHANI, SHATABDI, DURONTO (3A and CC)                             | BR-C1        |
| MAX_TICKETS_PER_MONTH / \_AADHAAR_VERIFIED ★   | 12 / 24                                                             | BR-B15       |
| DYNAMIC_FARE_THRESHOLD_PERCENT / MULTIPLIER ★  | 80 / 1.5 (used only when DYNAMIC_FARE_ENABLED is true, TATKAL only) | BR-F11       |

## 16. What these rules need from the ER diagram

The approved ER diagram already has payment retries, a refund table, per-passenger cancellation, queue positions, rule tables, staff duty, ID checks and MongoDB. These changes are still needed:

| \#  | Need                                | Change                                                                                                                                                                                                                                  |
|-----|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Quota everywhere (BR-Q10)           | Add quota and requested_quota to BOOKING. Make seat counts per run, class and quota. RAC and WL counts only matter for GENERAL and TATKAL.                                                                                              |
| 2   | Saved passengers                    | New SAVED_PASSENGER: owner user, name, age, gender, ID proof type, ID reference, disability type, berth preference. PASSENGER_BOOKING points to it and stores the concession type and proof chosen for that booking.                    |
| 3   | Fare per passenger (BR-F, BR-R3)    | Add base, concession, reservation, superfast, Tatkal, GST, insurance and total to PASSENGER_BOOKING.                                                                                                                                    |
| 4   | Seat hold (BR-B2)                   | New SEAT_HOLD: token, user, run, class, quota, seat counts, expiry.                                                                                                                                                                     |
| 5   | Settings                            | New SETTING table (section 15).                                                                                                                                                                                                         |
| 6   | Rule tables                         | FARE: slabs (class, from km, to km, rate), reservation and superfast per class, Tatkal percent. CONCESSION_RULE: add class, train type group, discount, proof types, active flag. REFUND_RULE: add flat minimum per class and clerkage. |
| 7   | TDR refunds                         | TDR_FILING: reason enum, evidence reference, refund amount, reviewed by and at. REFUND links to either a cancellation or a TDR.                                                                                                         |
| 8   | Run data in MySQL                   | TRAIN_SCHEDULE: delay_minutes, chart_prepared_at. New RUN_COACH_STATUS (run, coach, IN_SERVICE or OUT_OF_SERVICE).                                                                                                                      |
| 9   | Route stops                         | ROUTE_STOP: day_offset (0, 1, 2…) and platform_no.                                                                                                                                                                                      |
| 10  | Users                               | USER_ACCOUNT: account_status, aadhaar_verified, created_at. Role: PASSENGER, STAFF, ADMIN.                                                                                                                                              |
| 11  | Staff reports                       | New CROWD_REPORT and CLEANLINESS_REPORT tables (BR-ST8).                                                                                                                                                                                |
| 12  | Statuses and channel                | RESERVATION status adds BOARDED, NO_SHOW, CANCELLED. BOOKING.channel is ONLINE or COUNTER. PAYMENT method adds CASH.                                                                                                                    |
| 13  | Food                                | Remove FOOD_ORDER, FOOD_ORDER_ITEM and FOOD_ITEM. Keep counter booking and MAINTENANCE.                                                                                                                                                 |
| 14  | Maintenance                         | MAINTENANCE: type, status, coach or platform (exactly one), timestamps.                                                                                                                                                                 |
| 15  | RAC sharing and overlap             | Seat overlap is checked through the booking’s boarding and destination stops. Two RAC passengers may share one SIDE_LOWER berth (BR-S5).                                                                                                |
| 16  | Enums                               | TDR reasons, error codes (BR-B5), concession proof types, fine reasons, maintenance types, duty types.                                                                                                                                  |
| 17  | Stations and platforms ★            | STATION: platform_count and display_name. PLATFORM rows 1 to platform_count are created for every station (BR-A9).                                                                                                                      |
| 18  | Train data and running days ★       | TRAIN: short_name, display_name, train_type (RAJDHANI, SHATABDI, DURONTO, EXPRESS, VANDE_BHARAT) and running_days, a list of MON to SUN meaning the days the train leaves its origin (BR-B1a).                                          |
| 19  | Chart snapshot ★                    | New CHART_SNAPSHOT: run, generated_at, and one row per passenger (PNR, passenger number, coach, seat, berth, status, boarding and destination stops, concession flag). Written once at chart time and never changed (BR-B12a).          |
| 20  | Payments without a ticket ★         | PAYMENT keeps the gateway payment ID as unique, so it is processed once. REFUND can point to a payment that has no ticket, with reason PAYMENT_AFTER_EXPIRY (BR-B14).                                                                   |
| 21  | Monthly limit and berth condition ★ | BOOKING: berth_condition flag, and an index on user and created date so the monthly count is fast (BR-B6a, BR-B15).                                                                                                                     |
| 22  | Dynamic fare ★                      | PASSENGER_BOOKING fare line: add dynamic_surcharge (0 when the switch is off) (BR-F11).                                                                                                                                                 |

**Where data lives.** MySQL: everything that moves money or seats, plus master data, TDR and the audit log. MongoDB: live train status (a copy of schedule delay), notifications, complaints, activity logs and raw payment-gateway replies.

## 17. Dataset fixes and demo data plan

**The five final data files ★.** Routes (536 stops), users (50,000), passengers (75,000), stations (158) and trains (60) are final. Every other record (coaches, seats, fares, bookings, payments, notifications and so on) must use their IDs and codes: train IDs 101 to 160, station IDs 1 to 158 and their station codes, the route stop rows, user IDs and passenger IDs. Nothing may invent a new train, station or ID.

**Fixes to the data files**

- Trains: add display_name, built from the source city, destination city and type (example: “Pune – Howrah Duronto Express (12221)”), and keep the original short name as short_name. Correct the train type using a review list that the leaders approve first (at least 9 trains typed EXPRESS are Rajdhani or Shatabdi by name, and about 17 of the 23 carry a hint). Store running days as a real list.

- Routes: add day_offset to every stop, worked out from the clock times. Times only move forward and the longest gap between two stops is 6.8 hours, so this is exact (offsets are 0, 1 or 2). Replace placeholder 00:00 times: the arrival at a first stop becomes the departure (trains 114, 135, 157), and the departure at a last stop becomes the arrival (3 trains).

- Stations: raise platform_count to 3 at BMT, DPU, FKG, SRTN, MRHT, KNE, UD and KAWR. Add clean display names (“BHARUCH JN.” becomes “Bharuch Jn”) and rename City, State and platformNo to city, state and platformCount. Create platform rows 1 to platform_count for every station.

- Passengers: realistic gender split (OTHER about 1%), concession only as these rules allow (DIVYAANG only with a recorded disability and proof; no STUDENT or SENIOR concession), unique ID references, berth preference that matches the class (WINDOW only in CC, EC, 2S), and at least one adult on every booking.

- Users: add name, role, account_status and aadhaar_verified. Make phone numbers unique. Store passwords with a proper salted hash. Add the demo accounts as real rows: passenger rahul.sharma@example.com (password Password123!), the staff and admin accounts from the mock data, and COUNTER_WALKIN.

- Generate what does not exist yet: coaches and seats from the train layouts (section 4), fare tables (section 6), refund and concession rules, settings, quota seat counts per run, bookings, payments and queue positions.

- Mock data: do not keep mock bookings, schedules, seats, coaches, availability, payments, cancellations or TDR records; they are rebuilt. Keep and remap mock logins, grievances, incidents, fines, crowd and cleanliness reports. Stations: NDLS to 10, CNB 12, PNBE 90, HWH 69, BCT 21, ST 24, BRC 26, ADI 29, MAS 17, SBC 19. Trains, by number: 12951 to 129, 12952 to 130, 12301 to 111, 12302 to 112, 12002 to 140, 12007 to 153. Records that point to PRYJ, BSB or trains 22435, 22436, 12622 and 12932 are dropped or re-pointed to a real station or train.

**Demo plan.** Rajdhani, Shatabdi and Duronto trains have 836 to 936 seats per run. Use 7 journey dates starting 18 Oct 2026, and only dates on which the train runs (BR-B1a). Fill runs on purpose:

- 3 trains FULL: GENERAL seats sold out, RAC slots full, waiting list partly filled.

- 4 trains HALF full.

- All other runs empty, so live booking can still be shown.

A FULL run needs about 1,100 booking rows (confirmed, RAC and waiting list) and a HALF run about 450. Filling the 7 chosen trains on 2 dates each needs about 10,000 booking rows, taken from the 75,000 saved passengers. A saved passenger can appear in bookings on different dates.

Four stories to show the teacher, each with SQL screenshots: (1) a CONFIRMED passenger cancels and the first RAC passenger becomes CONFIRMED while the first WL passenger becomes RAC; (2) the same chain after an approved TDR; (3) the ticket collector marks a NO_SHOW and the same chain runs; (4) chart time cancels remaining WL tickets with full refunds and moves unused quota seats to GENERAL. Add a fifth: a full LADIES quota showing the fallback notice (BR-Q13).

## 18. Documents to update to match this version

- SYSTEM_FLOW: hold starts at Step 3 after the passenger count is chosen; TDR reasons per section 9; add the counter booking and maintenance flows; add the running-day check (BR-B1a); remove food.

- README, PROJECT_OVERVIEW, DEVELOPMENT_RULES (section 6.1): fare formula per section 6 (superfast added, concession on base fare before GST, rounding).

- DATA_SCHEMA, DATA_RELATIONSHIPS, database README, API_CONTRACT: rewrite to the approved ER diagram plus section 16, using the final IDs and codes of the five data files, running days and day offsets. Concession list: NONE and DIVYAANG active, SENIOR inactive, no STUDENT or MEDICAL. Add MongoDB collections, Razorpay test endpoints (create order, verify payment), counter booking and maintenance endpoints, quota fallback, and the new error codes (BERTH_PREFERENCE_NOT_MET, MONTHLY_LIMIT_EXCEEDED, CHART_PREPARED), the berth condition, the chart snapshot and late-payment refunds.

- Replace every link that points to c:/Users/Rohan/... with a relative link.

- Mock JSON and frontend field names: map to the new tables once the backend is ready.

## 19. Change process, decisions and sources

**Change process.** After this version is frozen, any change to a rule needs both leaders to agree, a new version number, and a line in the change log below. Values in the Settings table can be changed by an admin without a new version. Teams raise requests with the project leaders (DEVELOPMENT_RULES section 7).

**Decisions made**

1.  Draft v1 decisions 1 to 10 (hold at Step 3, chart 8 hours before, concession on base only, superfast included, RAC 10% and WL 25%, weakest-status booking, queue at payment, senior concession off, children at full fare, WL cancelled at chart) are accepted.

2.  ★ One clock: origin departure for both chart and refund slabs.

3.  ★ Seat share: TATKAL 10%, LADIES 10%, reserved blocks, rest GENERAL.

4.  ★ RAC and waitlist only for GENERAL and TATKAL; other quotas get the fallback notice.

5.  ★ At least one adult per PNR.

6.  ★ Razorpay test mode as the payment gateway; no real money.

7.  ★ Gender OTHER follows male age rules and is not eligible for LADIES; two RAC passengers may share one side berth.

8.  ★ Counter booking and maintenance are kept. Food ordering is removed.

9.  ★ Fare rates, CC and EC flat charges and train layouts are project values; Duronto joins Rajdhani and Shatabdi for the superfast charge and the 25% Divyangjan rate in 3A and CC (Vande Bharat only if such trains are added later).

10. ★ Booking window set to 7 days.

**Added after the dataset review ★**

- The five data files (routes, users, passengers, stations, trains) are final. All other data uses their IDs and codes.

- Train types are corrected through an approved review list. Display names are built from route and type.

- Running days follow BR-B1a: the day the train leaves its origin.

- Placeholder 00:00 times and platform counts are fixed as in section 17.

- No current train has 2S. Vande Bharat and Express have no trains in the data; their layouts stay for the future.

**Added after the DBMS scenario check ★**

- A payment that arrives after the hold expired, or with no seat to give, is refunded in full automatically (insurance included) and never creates a duplicate ticket (BR-B14).

- Optional berth condition (BR-B6a) and a monthly ticket limit of 12, or 24 with Aadhaar (BR-B15).

- Chart lockout: no new bookings after the chart, and a saved chart snapshot (BR-B12a), with a fixed chart processing order (BR-B16).

- A seat freed by auto-upgrade starts promotion in the old class (BR-S6, BR-W4).

- Dynamic Tatkal fare exists only as a switch, off by default (BR-F11). The solo-female seat rule was not adopted because it is not a railway rule; coach-occupancy reports with HAVING cover that need.

- Techniques belong to the database design step, not to these rules: locks for the Tatkal rush, savepoints for the berth condition and quota fallback, triggers and procedures for promotion, and a snapshot table for the chart.

**Change log.** 1.0 (17 Oct 2026): frozen after the dataset review (stations and trains files, Duronto, running days, final IDs) and the DBMS scenario check (late payments, berth condition, monthly limit, chart lockout and snapshot, auto-upgrade promotion, optional dynamic Tatkal fare).

**Sources.** Found through search; recheck every number against official sources before final submission, because railway rules change often.

- Reservation and superfast charges: erail.in, Components of Indian Railways fare (https://erail.in/info/train-fare-general/401).

- Fare hike of 26 Dec 2025 (2 paise per km for non-AC mail/express and AC classes): Business Standard (https://www.business-standard.com/india-news/railway-ministry-notifies-fare-hike-new-train-ticket-rates-friday-125122500706_1.html).

- Lower-berth quotas, disability quota, automatic lower berth: Lok Sabha question 3199, 19 Mar 2025; senior citizen facilities: Rajya Sabha answer, 7 Feb 2025.

- Disability proof and UDID: Railway Board circular, 30 Jul 2026. Disability concession percentages: Vikaspedia concession table.

- Senior concession status: FindMyTrain guide. Tatkal Aadhaar and OTP: Business Standard, June 2025.

- Cancellation slabs from April 2026: redBus and Goodreturns. Flat cancellation charges and TDR categories: ixigo and erail TDR rules.
