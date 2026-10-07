# Admin Endpoint Map

This table maps the Admin UI features to the corresponding service functions and API endpoints as defined in `API_CONTRACT.md`.

| Feature | Service Function | Method | Path | Contract Section |
|---|---|---|---|---|
| Auth Login | `authService.login` | POST | `/api/auth/admin/login` | Auth |
| Users List | `userService.getUsers` | GET | `/api/admin/users` | Admin - Users |
| Update User Status | `userService.updateUserStatus` | PUT | `/api/admin/users/:userId/status` | Admin - Users |
| Staff List | `staffService.getStaff` | GET | `/api/admin/staff` | Admin - Staff |
| Create Staff | `staffService.createStaff` | POST | `/api/admin/staff` | Admin - Staff |
| Update Staff | `staffService.updateStaff` | PUT | `/api/admin/staff/:staffId` | Admin - Staff |
| Trains List | `trainService.getTrains` | GET | `/api/admin/trains` | Admin - Trains |
| Get Train | `trainService.getTrainById` | GET | `/api/trains/:trainId` | Shared - Trains |
| Create Train | `trainService.createTrain` | POST | `/api/admin/trains` | Admin - Trains |
| Update Train | `trainService.updateTrain` | PUT | `/api/admin/trains/:trainId` | Admin - Trains |
| Delete Train | `trainService.deleteTrain` | DELETE | `/api/admin/trains/:trainId` | Admin - Trains |
| Check Train Avail | `trainService.getAvailability` | GET | `/api/trains/:trainId/availability` | Shared - Trains |
| Routes List | `routeService.getRoutes` | GET | `/api/admin/routes` | Admin - Routes |
| Create Route | `routeService.createRoute` | POST | `/api/admin/routes` | Admin - Routes |
| Update Route | `routeService.updateRoute` | PUT | `/api/admin/routes/:routeId` | Admin - Routes |
| Delete Route | `routeService.deleteRoute` | DELETE | `/api/admin/routes/:routeId` | Admin - Routes |
| Schedules List | `scheduleService.getSchedules` | GET | `/api/admin/schedules` | Admin - Schedules |
| Create Schedule | `scheduleService.createSchedule` | POST | `/api/admin/schedules` | Admin - Schedules |
| Update Schedule | `scheduleService.updateSchedule` | PUT | `/api/admin/schedules/:scheduleId` | Admin - Schedules |
| Delete Schedule | `scheduleService.deleteSchedule` | DELETE | `/api/admin/schedules/:scheduleId` | Admin - Schedules |
| Stations List | `stationService.getStations` | GET | `/api/admin/stations` | Admin - Stations |
| Create Station | `stationService.createStation` | POST | `/api/admin/stations` | Admin - Stations |
| Update Station | `stationService.updateStation` | PUT | `/api/admin/stations/:stationId` | Admin - Stations |
| Delete Station | `stationService.deleteStation` | DELETE | `/api/admin/stations/:stationId` | Admin - Stations |
| Platforms List | `platformService.getPlatforms` | GET | `/api/admin/platforms` | Admin - Platforms |
| Create Platform | `platformService.createPlatform` | POST | `/api/admin/platforms` | Admin - Platforms |
| Update Platform | `platformService.updatePlatform` | PUT | `/api/admin/platforms/:platformId` | Admin - Platforms |
| Delete Platform | `platformService.deletePlatform` | DELETE | `/api/admin/platforms/:platformId` | Admin - Platforms |
| Coaches List | `coachService.getCoaches` | GET | `/api/admin/coaches` | Admin - Coaches |
| Create Coach | `coachService.createCoach` | POST | `/api/admin/coaches` | Admin - Coaches |
| Update Coach | `coachService.updateCoach` | PUT | `/api/admin/coaches/:coachId` | Admin - Coaches |
| Delete Coach | `coachService.deleteCoach` | DELETE | `/api/admin/coaches/:coachId` | Admin - Coaches |
| Seats List | `seatService.getSeats` | GET | `/api/admin/seats` | Admin - Seats |
| Create Seat | `seatService.createSeat` | POST | `/api/admin/seats` | Admin - Seats |
| Update Seat | `seatService.updateSeat` | PUT | `/api/admin/seats/:seatId` | Admin - Seats |
| Delete Seat | `seatService.deleteSeat` | DELETE | `/api/admin/seats/:seatId` | Admin - Seats |
| Fares List | `fareService.getFares` | GET | `/api/admin/fares` | Admin - Fares |
| Create Fare | `fareService.createFare` | POST | `/api/admin/fares` | Admin - Fares |
| Update Fare | `fareService.updateFare` | PUT | `/api/admin/fares/:fareId` | Admin - Fares |
| Delete Fare | `fareService.deleteFare` | DELETE | `/api/admin/fares/:fareId` | Admin - Fares |
| Quotas List | `quotaService.getQuotas` | GET | `/api/admin/quotas` | Admin - Quotas |
| Create Quota | `quotaService.createQuota` | POST | `/api/admin/quotas` | Admin - Quotas |
| Update Quota | `quotaService.updateQuota` | PUT | `/api/admin/quotas/:quotaId` | Admin - Quotas |
| Delete Quota | `quotaService.deleteQuota` | DELETE | `/api/admin/quotas/:quotaId` | Admin - Quotas |
| Bookings List | `bookingService.getBookings` | GET | `/api/admin/bookings` | Admin - Bookings |
| View Booking | `bookingService.getBookingByPnr` | GET | `/api/bookings/:pnr` | Shared - Bookings |
| Update Booking | `bookingService.updateBooking` | PUT | `/api/admin/bookings/:pnr` | Admin - Bookings |
| Cancel Booking | `bookingService.cancelBooking` | POST | `/api/admin/bookings/:pnr/cancel` | Admin - Bookings |
| TDR List | `tdrService.getTdrs` | GET | `/api/admin/tdr` | Admin - TDR |
| Update TDR | `tdrService.updateTdrStatus` | PUT | `/api/admin/tdr/:tdrId` | Admin - TDR |
| Reports | `reportService.getRevenueReport` etc | GET | `/api/admin/reports/(revenue\|bookings\|cancellations\|occupancy\|fines\|delays\|complaints)` | Admin - Reports |
| Audit Logs | `auditLogService.getLogs` | GET | `/api/admin/audit-logs` | Admin - Audit Logs |
| Get Notifications | `notificationService.getNotifications` | GET | `/api/notifications` | Shared - Notifications |
| Read Notification | `notificationService.markAsRead` | PUT | `/api/notifications/:notificationId/read` | Shared - Notifications |
