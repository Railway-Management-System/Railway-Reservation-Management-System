# Datasets

This folder holds the five final datasets of the National Railway Reservation & Management System. All other data (coaches, seats, fares, bookings, payments and so on) must follow the IDs and codes used in these files.

| Dataset | File Name | Size | What it contains |
|---|---|---|---|
| Stations | `stations_158_final.xlsx` | 158 stations | Every station used by our trains, with its city. Station IDs run from 1 to 158. |
| Trains | `final_trains_60.xlsx` | 60 trains | Train details with IDs 101 to 160, including the train type and the days of the week each train runs (running days). |
| Routes | `final_routes_536.xlsx` | 536 stops | The stops of every train in order, with arrival and departure times and the day offset of each stop. |
| Users | `users_synthetic_2.csv` | 50,000 users | Registered user accounts. |
| Passengers | `passengers_synthetic_2.csv` | 75,000 passengers | Saved passenger profiles that belong to users. |

## Rules

- The Business Rules document (`docs/BUSINESS_RULES.md`) is the source of truth for how this data is used.
- Do not change IDs or codes in these files. Other data depends on them.
- Mock data in the `mock-data` folder will later be replaced or remapped to follow these files.
