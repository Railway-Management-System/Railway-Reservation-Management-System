import { API_CONFIG, isServiceMock } from '../config/api.config';
import { BookingStatus } from '../constants/enums';
import { Booking, BookingDetail } from '../types/booking';
import { Cancellation } from '../types/cancellation';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export interface BookingFilters {
  pnr?: string;
  bookingStatus?: BookingStatus;
  trainId?: number;
  journeyDate?: string;
}

export const bookingService = {
  async getBookings(filters?: BookingFilters): Promise<Booking[]> {
    if (isServiceMock('bookings')) {
      await simulateLatency();
      let list = mockStore.getBookings();

      if (filters?.pnr) {
        list = list.filter((b) => b.pnr.includes(filters.pnr!));
      }
      if (filters?.bookingStatus) {
        list = list.filter((b) => b.bookingStatus === filters.bookingStatus);
      }
      if (filters?.trainId) {
        list = list.filter((b) => b.trainId === filters.trainId);
      }
      if (filters?.journeyDate) {
        list = list.filter((b) => b.journeyDate === filters.journeyDate);
      }

      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const query = new URLSearchParams();
    if (filters?.pnr) query.append('pnr', filters.pnr);
    if (filters?.bookingStatus) query.append('bookingStatus', filters.bookingStatus);
    if (filters?.trainId) query.append('trainId', filters.trainId.toString());
    if (filters?.journeyDate) query.append('journeyDate', filters.journeyDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const rows = await httpRequest<any[]>(`/api/admin/bookings${queryString}`);
    return (rows || []).map((row) => ({
      bookingId: row.bookingId || Number(String(row.pnr).slice(-6)) || 1,
      pnr: String(row.pnr),
      userId: Number(row.userId || row.user_id || 0),
      userName: row.userName || row.full_name,
      trainId: Number(row.trainId || row.train_id || 0),
      trainNumber: row.trainNumber || row.train_number,
      trainName: row.trainName || row.display_name,
      journeyDate: String(row.journeyDate || row.journey_date || ''),
      boardingStationId: Number(row.boardingStationId || 0),
      destinationStationId: Number(row.destinationStationId || 0),
      boardingStationCode: row.boardingStationCode,
      destinationStationCode: row.destinationStationCode,
      classType: row.classType || row.class_code,
      quota: row.quota,
      bookingStatus: (row.bookingStatus || row.status) as BookingStatus,
      totalFare: Number(row.totalFare !== undefined ? row.totalFare : row.total_fare || 0),
      createdAt: String(row.createdAt || row.created_at || ''),
    }));
  },

  async getBookingByPnr(pnr: string): Promise<BookingDetail> {
    if (isServiceMock('bookings')) {
      await simulateLatency();
      const booking = mockStore.getBookings().find((b) => b.pnr === pnr);
      if (!booking) throw new Error(`Booking with PNR ${pnr} not found.`);

      const user = mockStore.getUsers().find((u) => u.userId === booking.userId);
      const train = mockStore.getTrains().find((t) => t.trainId === booking.trainId);
      const stations = mockStore.getStations();
      const bStation = stations.find((s) => s.stationId === booking.boardingStationId);
      const dStation = stations.find((s) => s.stationId === booking.destinationStationId);

      const bookingPassengers = mockStore.getBookingPassengers().filter((bp) => bp.bookingId === booking.bookingId);
      const allPassengers = mockStore.getPassengers();
      const passMap = new Map(allPassengers.map((p) => [p.passengerId, p]));

      const passengersWithNames = bookingPassengers.map((bp) => {
        const pObj = passMap.get(bp.passengerId);
        return {
          ...bp,
          name: pObj ? pObj.name : `Passenger #${bp.passengerId}`,
        };
      });

      const payment = mockStore.getPayments().find((p) => p.bookingId === booking.bookingId) || null;
      const cancellation = mockStore.getCancellations().find((c) => c.bookingId === booking.bookingId) || null;
      const tdr = mockStore.getTdr().find((t) => t.bookingId === booking.bookingId) || null;

      return {
        ...booking,
        userName: user?.name,
        userEmail: user?.email,
        userPhone: user?.phone,
        trainNumber: train?.trainNumber,
        trainName: train?.trainName,
        boardingStationCode: bStation?.stationCode,
        destinationStationCode: dStation?.stationCode,
        passengers: passengersWithNames,
        payment,
        cancellation,
        tdr,
      };
    }

    const res = await httpRequest<any>(`/api/bookings/${pnr}`);
    const passengers = (res.passengers || []).map((p: any, idx: number) => ({
      bookingPassengerId: p.bookingPassengerId || idx + 1,
      bookingId: res.bookingId || Number(String(res.pnr).slice(-6)) || 1,
      passengerId: p.passengerNo || idx + 1,
      name: p.name,
      coachNumber: p.coachNumber || null,
      seatNumber: p.seatNumber !== null && p.seatNumber !== undefined ? Number(p.seatNumber) : null,
      berthType: p.berthType || null,
      passengerStatus: p.status || p.passengerStatus || 'CONFIRMED',
    }));

    return {
      bookingId: res.bookingId || Number(String(res.pnr).slice(-6)) || 1,
      pnr: String(res.pnr),
      userId: Number(res.userId || res.user_id || 0),
      userName: res.userName,
      trainId: Number(res.trainId || 0),
      trainNumber: res.trainNumber,
      trainName: res.trainName,
      journeyDate: String(res.journeyDate || ''),
      boardingStationId: Number(res.boardingStationId || 0),
      destinationStationId: Number(res.destinationStationId || 0),
      boardingStationCode: res.boardingStation?.stationCode || res.boardingStationCode,
      destinationStationCode: res.destinationStation?.stationCode || res.destinationStationCode,
      classType: res.classType,
      quota: res.quota,
      bookingStatus: (res.bookingStatus || res.status) as BookingStatus,
      totalFare: Number(res.totalFare || 0),
      createdAt: String(res.createdAt || ''),
      passengers,
      payment: res.payment || null,
      cancellation: res.cancellation || null,
      tdr: res.tdr || null,
    };
  },


  async overrideBooking(pnr: string, payload: Partial<Booking>): Promise<Booking> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const bookings = mockStore.getBookings();
      const idx = bookings.findIndex((b) => b.pnr === pnr);
      if (idx === -1) throw new Error(`Booking with PNR ${pnr} not found.`);

      const prev = { ...bookings[idx] };
      const updated: Booking = { ...prev, ...payload };
      bookings[idx] = updated;
      mockStore.setBookings([...bookings]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'OVERRIDE',
        entityType: 'BOOKING',
        entityId: pnr,
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Booking>(`/api/admin/bookings/${pnr}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async cancelBooking(
    pnr: string,
    passengerIds?: number[]
  ): Promise<{ cancellationId: number; pnr: string; cancellationCharge: number; refundAmount: number; status: string }> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const booking = mockStore.getBookings().find((b) => b.pnr === pnr);
      if (!booking) throw new Error(`Booking with PNR ${pnr} not found.`);

      const cancellations = mockStore.getCancellations();
      const newCancelId = Math.max(...cancellations.map((c) => c.cancellationId), 0) + 1;

      // Cancellation formula: charge Rs 120 per passenger, refund remainder
      const isSelective = passengerIds && passengerIds.length > 0;
      const passengerCountToCancel = isSelective ? passengerIds.length : 1;
      const charge = passengerCountToCancel * 120;
      const refund = Math.max(0, booking.totalFare - charge);

      const record: Cancellation = {
        cancellationId: newCancelId,
        bookingId: booking.bookingId,
        passengerId: isSelective ? passengerIds[0] : null,
        cancellationDate: new Date().toISOString(),
        cancellationCharge: charge,
        refundAmount: refund,
        status: 'PROCESSED',
      };
      mockStore.setCancellations([...cancellations, record]);

      // Update booking status if whole ticket is cancelled
      if (!isSelective) {
        booking.bookingStatus = 'CANCELLED';
        const allBookings = mockStore.getBookings();
        const bIdx = allBookings.findIndex((b) => b.pnr === pnr);
        if (bIdx !== -1) allBookings[bIdx] = { ...booking };
        mockStore.setBookings([...allBookings]);

        // Also update passenger statuses to CANCELLED
        const allBps = mockStore.getBookingPassengers();
        allBps.forEach((bp) => {
          if (bp.bookingId === booking.bookingId) {
            bp.passengerStatus = 'CANCELLED';
          }
        });
        mockStore.setBookingPassengers([...allBps]);
      }

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'BOOKING_CANCELLATION',
        entityId: pnr,
        oldValue: { bookingStatus: 'CONFIRMED' },
        newValue: { bookingStatus: 'CANCELLED', cancellationCharge: charge, refundAmount: refund },
      });

      return {
        cancellationId: newCancelId,
        pnr,
        cancellationCharge: charge,
        refundAmount: refund,
        status: 'PROCESSED',
      };
    }

    try {
      return await httpRequest<{ cancellationId: number; pnr: string; cancellationCharge: number; refundAmount: number; status: string }>(
        `/api/bookings/${pnr}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ passengerNos: passengerIds || [] }),
        }
      );
    } catch (err: any) {
      if (err.status === 404) {
        return await httpRequest<{ cancellationId: number; pnr: string; cancellationCharge: number; refundAmount: number; status: string }>(
          `/api/admin/bookings/${pnr}/cancel`,
          {
            method: 'POST',
            body: JSON.stringify({ passengerIds: passengerIds || [] }),
          }
        );
      }
      throw err;
    }
  },
};

