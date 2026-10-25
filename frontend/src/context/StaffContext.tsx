import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Staff,
  Station,
  Train,
  RouteStop,
  Schedule,
  ManifestPassenger,
  Vacancy,
  Fine,
  Incident,
  CrowdReport,
  CleanlinessReport,
  BoardingStatus,
  VerificationStatus
} from '../types';
import {
  staffApiService,
  StaffAssignment,
  ChartPassenger
} from '../services/staffApiService';

const STORAGE_KEY = 'RRMS_STAFF_REACT_STATE_V1';

const INITIAL_DATA = {
  staffList: [
    {
      staffId: 1,
      userId: 4,
      employeeId: "EMP-TC-101",
      name: "Vikram Singh",
      designation: "Ticket Collector (TC)",
      assignedStationId: 1,
      assignedTrainId: 101,
      assignedCoaches: ["B1", "B2", "A1"],
      shift: "16:00 - 00:00 (Evening Shift)",
      status: "ON_DUTY" as const
    },
    {
      staffId: 2,
      userId: 5,
      employeeId: "EMP-SM-205",
      name: "Sunita Rao",
      designation: "Station Manager",
      assignedStationId: 1,
      assignedTrainId: null,
      assignedCoaches: [],
      shift: "06:00 - 14:00 (Morning Shift)",
      status: "ON_DUTY" as const
    },
    {
      staffId: 3,
      userId: 6,
      employeeId: "EMP-TC-108",
      name: "Ramesh Nair",
      designation: "Ticket Collector (TC)",
      assignedStationId: 7,
      assignedTrainId: 110,
      assignedCoaches: ["C1", "C2"],
      shift: "08:00 - 16:00 (Day Shift)",
      status: "OFF_DUTY" as const
    }
  ],

  stations: [
    { stationId: 1, stationCode: "NDLS", stationName: "New Delhi Railway Station", city: "New Delhi", state: "Delhi" },
    { stationId: 2, stationCode: "CNB", stationName: "Kanpur Central", city: "Kanpur", state: "Uttar Pradesh" },
    { stationId: 3, stationCode: "PRYJ", stationName: "Prayagraj Junction", city: "Prayagraj", state: "Uttar Pradesh" },
    { stationId: 4, stationCode: "BSB", stationName: "Varanasi Junction", city: "Varanasi", state: "Uttar Pradesh" },
    { stationId: 5, stationCode: "PNBE", stationName: "Patna Junction", city: "Patna", state: "Bihar" },
    { stationId: 6, stationCode: "HWH", stationName: "Howrah Junction", city: "Kolkata", state: "West Bengal" },
    { stationId: 7, stationCode: "BCT", stationName: "Mumbai Central", city: "Mumbai", state: "Maharashtra" },
    { stationId: 8, stationCode: "ST", stationName: "Surat", city: "Surat", state: "Gujarat" },
    { stationId: 9, stationCode: "BRC", stationName: "Vadodara Junction", city: "Vadodara", state: "Gujarat" },
    { stationId: 10, stationCode: "ADI", stationName: "Ahmedabad Junction", city: "Ahmedabad", state: "Gujarat" },
    { stationId: 11, stationCode: "MAS", stationName: "MGR Chennai Central", city: "Chennai", state: "Tamil Nadu" },
    { stationId: 12, stationCode: "SBC", stationName: "KSR Bengaluru City Junction", city: "Bengaluru", state: "Karnataka" }
  ],

  trains: [
    {
      trainId: 101,
      trainNumber: "12951",
      trainName: "Mumbai Tejas Rajdhani Express",
      trainType: "RAJDHANI",
      sourceStationId: 7,
      destinationStationId: 1,
      runningDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      status: "ACTIVE"
    },
    {
      trainId: 102,
      trainNumber: "12952",
      trainName: "New Delhi Mumbai Tejas Rajdhani",
      trainType: "RAJDHANI",
      sourceStationId: 1,
      destinationStationId: 7,
      runningDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      status: "ACTIVE"
    },
    {
      trainId: 105,
      trainNumber: "22436",
      trainName: "Vande Bharat Express",
      trainType: "VANDE_BHARAT",
      sourceStationId: 1,
      destinationStationId: 4,
      runningDays: ["TUE", "WED", "FRI", "SAT", "SUN"],
      status: "ACTIVE"
    },
    {
      trainId: 110,
      trainNumber: "12932",
      trainName: "Ahmedabad Mumbai Central Double Decker",
      trainType: "EXPRESS",
      sourceStationId: 10,
      destinationStationId: 7,
      runningDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      status: "ACTIVE"
    }
  ],

  routes: [
    { routeId: 1001, trainId: 101, stationId: 7, stopSequence: 1, arrivalTime: "17:00", departureTime: "17:00", distanceFromOrigin: 0, platformNumber: 1 },
    { routeId: 1002, trainId: 101, stationId: 8, stopSequence: 2, arrivalTime: "19:42", departureTime: "19:47", distanceFromOrigin: 263, platformNumber: 1 },
    { routeId: 1003, trainId: 101, stationId: 9, stopSequence: 3, arrivalTime: "21:05", departureTime: "21:15", distanceFromOrigin: 392, platformNumber: 2 },
    { routeId: 1004, trainId: 101, stationId: 1, stopSequence: 4, arrivalTime: "08:32", departureTime: "08:32", distanceFromOrigin: 1384, platformNumber: 3 },
    { routeId: 1009, trainId: 105, stationId: 1, stopSequence: 1, arrivalTime: "06:00", departureTime: "06:00", distanceFromOrigin: 0, platformNumber: 16 },
    { routeId: 1010, trainId: 105, stationId: 2, stopSequence: 2, arrivalTime: "10:08", departureTime: "10:10", distanceFromOrigin: 440, platformNumber: 5 },
    { routeId: 1011, trainId: 105, stationId: 3, stopSequence: 3, arrivalTime: "12:08", departureTime: "12:10", distanceFromOrigin: 635, platformNumber: 6 },
    { routeId: 1012, trainId: 105, stationId: 4, stopSequence: 4, arrivalTime: "14:00", departureTime: "14:00", distanceFromOrigin: 759, platformNumber: 1 }
  ],

  schedules: [
    { scheduleId: 501, trainId: 101, journeyDate: "2026-10-10", status: "ON_TIME" as const, delayMinutes: 0, currentStation: "BCT (Mumbai Central)", nextStation: "ST (Surat)", platformNumber: 1 },
    { scheduleId: 508, trainId: 105, journeyDate: "2026-10-10", status: "ON_TIME" as const, delayMinutes: 0, currentStation: "NDLS (New Delhi)", nextStation: "CNB (Kanpur)", platformNumber: 16 },
    { scheduleId: 515, trainId: 110, journeyDate: "2026-10-10", status: "ON_TIME" as const, delayMinutes: 0, currentStation: "ADI (Ahmedabad)", nextStation: "BCT (Mumbai Central)", platformNumber: 2 }
  ],

  manifest: [
    {
      manifestId: 1,
      bookingId: 1001,
      pnr: "2849102841",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 1,
      name: "Rahul Sharma",
      age: 28,
      gender: "MALE",
      idProofType: "AADHAAR",
      idProofReference: "XXXX-XXXX-1920",
      coachNumber: "B1",
      seatNumber: 23,
      berthType: "LOWER",
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "NOT_VERIFIED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "",
      verifiedAt: null
    },
    {
      manifestId: 2,
      bookingId: 1001,
      pnr: "2849102841",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 2,
      name: "Sunita Sharma",
      age: 56,
      gender: "FEMALE",
      idProofType: "AADHAAR",
      idProofReference: "XXXX-XXXX-3829",
      coachNumber: "B1",
      seatNumber: 24,
      berthType: "MIDDLE",
      classType: "3A",
      quota: "SENIOR_CITIZEN",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "NOT_VERIFIED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "",
      verifiedAt: null
    },
    {
      manifestId: 3,
      bookingId: 1008,
      pnr: "5183920194",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 9,
      passengerId: 7,
      name: "Ananya Deshmukh",
      age: 29,
      gender: "FEMALE",
      idProofType: "PASSPORT",
      idProofReference: "Z8194012",
      coachNumber: "B1",
      seatNumber: 21,
      berthType: "LOWER",
      classType: "3A",
      quota: "LADIES",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "BOARDED" as const,
      verificationStatus: "VALID" as const,
      verificationNotes: "Original passport inspected",
      verifiedAt: "2026-10-10T16:50:00Z"
    },
    {
      manifestId: 4,
      bookingId: 1009,
      pnr: "7729103841",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 8,
      name: "Karan Johar Malhotra",
      age: 41,
      gender: "MALE",
      idProofType: "PAN",
      idProofReference: "KJMPS8819A",
      coachNumber: "B1",
      seatNumber: 22,
      berthType: "MIDDLE",
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "NO_SHOW" as const,
      verificationStatus: "INVALID" as const,
      verificationNotes: "Passenger did not report; seat vacated for RAC",
      verifiedAt: "2026-10-10T17:05:00Z"
    },
    {
      manifestId: 5,
      bookingId: 1010,
      pnr: "9102837461",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 8,
      destinationStationId: 1,
      passengerId: 9,
      name: "Suresh Babu",
      age: 50,
      gender: "MALE",
      idProofType: "DRIVING_LICENSE",
      idProofReference: "GJ-05-2018-0918",
      coachNumber: "B2",
      seatNumber: 11,
      berthType: "LOWER",
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "NOT_VERIFIED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "",
      verifiedAt: null
    },
    {
      manifestId: 6,
      bookingId: 1011,
      pnr: "3019284712",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 10,
      name: "Deepa Narang",
      age: 33,
      gender: "FEMALE",
      idProofType: "AADHAAR",
      idProofReference: "XXXX-XXXX-9901",
      coachNumber: "A1",
      seatNumber: 3,
      berthType: "LOWER",
      classType: "2A",
      quota: "GENERAL",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "BOARDED" as const,
      verificationStatus: "VALID" as const,
      verificationNotes: "Aadhaar e-card verified",
      verifiedAt: "2026-10-10T16:55:00Z"
    },
    {
      manifestId: 7,
      bookingId: 1012,
      pnr: "4491029381",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 11,
      name: "Harish Varma",
      age: 37,
      gender: "MALE",
      idProofType: "VOTER_ID",
      idProofReference: "VTR-DL-29381",
      coachNumber: "A1",
      seatNumber: 4,
      berthType: "UPPER",
      classType: "2A",
      quota: "GENERAL",
      bookingStatus: "CONFIRMED" as const,
      boardingStatus: "NOT_VERIFIED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "",
      verifiedAt: null
    },
    {
      manifestId: 8,
      bookingId: 1002,
      pnr: "4920194820",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 4,
      name: "Priya Patel",
      age: 31,
      gender: "FEMALE",
      idProofType: "PASSPORT",
      idProofReference: "P1928401",
      coachNumber: "B1",
      seatNumber: 7,
      berthType: "SIDE_LOWER",
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "RAC" as const,
      racRank: 1,
      boardingStatus: "BOARDED" as const,
      verificationStatus: "VALID" as const,
      verificationNotes: "RAC passenger aboard - prioritized for vacant berth",
      verifiedAt: "2026-10-10T17:00:00Z"
    },
    {
      manifestId: 9,
      bookingId: 1013,
      pnr: "6192837401",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 12,
      name: "Manish Tiwari",
      age: 26,
      gender: "MALE",
      idProofType: "AADHAAR",
      idProofReference: "XXXX-XXXX-6612",
      coachNumber: "B1",
      seatNumber: 8,
      berthType: "SIDE_UPPER",
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "RAC" as const,
      racRank: 2,
      boardingStatus: "BOARDED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "",
      verifiedAt: null
    },
    {
      manifestId: 10,
      bookingId: 1003,
      pnr: "8491029482",
      trainId: 101,
      journeyDate: "2026-10-10",
      boardingStationId: 7,
      destinationStationId: 1,
      passengerId: 3,
      name: "Rohan Sharma",
      age: 22,
      gender: "MALE",
      idProofType: "PAN",
      idProofReference: "ABCDE1234F",
      coachNumber: null,
      seatNumber: null,
      berthType: null,
      classType: "3A",
      quota: "GENERAL",
      bookingStatus: "WAITING_LIST" as const,
      wlRank: 1,
      boardingStatus: "NOT_VERIFIED" as const,
      verificationStatus: "UNCHECKED" as const,
      verificationNotes: "Waiting list #1",
      verifiedAt: null
    }
  ],

  vacancies: [
    { vacancyId: 1, trainId: 101, coachNumber: "B1", seatNumber: 22, berthType: "MIDDLE", reason: "NO_SHOW (Karan Johar vacating BCT -> NDLS)", availableFromStationId: 7, availableToStationId: 1 },
    { vacancyId: 2, trainId: 101, coachNumber: "B1", seatNumber: 25, berthType: "UPPER", reason: "UNALLOCATED_QUOTA", availableFromStationId: 7, availableToStationId: 1 },
    { vacancyId: 3, trainId: 101, coachNumber: "A1", seatNumber: 1, berthType: "LOWER", reason: "LAST_MINUTE_CANCELLATION", availableFromStationId: 7, availableToStationId: 1 }
  ],

  fines: [
    {
      fineId: 601,
      staffId: 1,
      passengerName: "Ajay Kumar",
      idProofReference: "VOTER-88491",
      trainId: 101,
      amount: 550.00,
      reason: "TICKETLESS_TRAVEL",
      paymentStatus: "PAID" as const,
      issuedAt: "2026-10-01T20:15:00Z",
      receiptNumber: "FINE-2026-101-001"
    },
    {
      fineId: 602,
      staffId: 1,
      passengerName: "Kishore Dave",
      idProofReference: "PAN-BRK1920",
      trainId: 101,
      amount: 300.00,
      reason: "TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE",
      paymentStatus: "PAID" as const,
      issuedAt: "2026-10-01T22:30:00Z",
      receiptNumber: "FINE-2026-101-002"
    },
    {
      fineId: 603,
      staffId: 3,
      passengerName: "Manish Gupta",
      idProofReference: "AADHAAR-9901-2244",
      trainId: 110,
      amount: 250.00,
      reason: "UNBOOKED_EXCESS_LUGGAGE",
      paymentStatus: "UNPAID" as const,
      issuedAt: "2026-10-04T08:45:00Z",
      receiptNumber: "FINE-2026-110-003"
    }
  ],

  incidents: [
    {
      incidentId: 851,
      reportedBy: 1,
      type: "MEDICAL_EMERGENCY",
      severity: "HIGH" as const,
      locationType: "TRAIN" as const,
      stationId: null,
      trainId: 101,
      description: "Elderly passenger experienced acute breathing difficulty between Surat and Vadodara. First aid administered; medical team requested at Vadodara Junction.",
      status: "RESOLVED" as const,
      createdAt: "2026-10-01T20:50:00Z"
    },
    {
      incidentId: 852,
      reportedBy: 2,
      type: "TECHNICAL_FAILURE",
      severity: "MEDIUM" as const,
      locationType: "STATION" as const,
      stationId: 1,
      trainId: null,
      description: "Display screen malfunction on Platform 16 causing passenger confusion.",
      status: "ACKNOWLEDGED" as const,
      createdAt: "2026-10-05T07:20:00Z"
    }
  ],

  crowdReports: [
    {
      crowdReportId: 951,
      stationId: 1,
      platformNumber: 16,
      crowdLevel: "HIGH" as const,
      headCount: 450,
      recordedBy: 2,
      recordedAt: "2026-10-06T05:30:00Z"
    },
    {
      crowdReportId: 952,
      stationId: 1,
      platformNumber: 3,
      crowdLevel: "MODERATE" as const,
      headCount: 220,
      recordedBy: 2,
      recordedAt: "2026-10-06T08:00:00Z"
    },
    {
      crowdReportId: 953,
      stationId: 7,
      platformNumber: 1,
      crowdLevel: "OVERCROWDED" as const,
      headCount: 850,
      recordedBy: 3,
      recordedAt: "2026-10-06T16:30:00Z"
    }
  ],

  cleanlinessReports: [
    {
      reportId: 751,
      reportedBy: 1,
      trainId: 101,
      coachId: 301,
      stationId: null,
      platformNumber: null,
      issueType: "TOILET_DIRTY",
      description: "Coach B1 western washroom hygiene issue reported by passenger.",
      status: "RESOLVED" as const,
      createdAt: "2026-10-01T17:30:00Z"
    },
    {
      reportId: 752,
      reportedBy: 2,
      trainId: null,
      coachId: null,
      stationId: 1,
      platformNumber: 16,
      issueType: "LITTER",
      description: "Accumulation of plastic cups and packaging near waiting area seats.",
      status: "ATTENDING" as const,
      createdAt: "2026-10-06T06:15:00Z"
    },
    {
      reportId: 753,
      reportedBy: 1,
      trainId: 101,
      coachId: 303,
      stationId: null,
      platformNumber: null,
      issueType: "WATER_SHORTAGE",
      description: "Low overhead tank water pressure in coach A1 washrooms.",
      status: "RESOLVED" as const,
      createdAt: "2026-10-01T21:00:00Z"
    }
  ]
};

interface StaffContextType {
  data: typeof INITIAL_DATA;
  activeStaffId: number;
  activeStaff: Staff;
  activeTrain: Train | undefined;
  activeSchedule: Schedule | undefined;
  currentAssignment: StaffAssignment | null;
  serverChart: ChartPassenger[];
  chartStatus: { loading: boolean; error: string | null; prepared: boolean };
  switchStaff: (staffId: number) => void;
  refreshAssignmentAndChart: () => Promise<void>;
  markPassengerBoarding: (manifestId: number, status: BoardingStatus, verifyStatus?: VerificationStatus, notes?: string) => Promise<void>;
  verifyPassenger: (pnr: string, passengerNo: number, result: 'VALID' | 'INVALID' | 'MISMATCH', remarks?: string) => Promise<{ success: boolean; message: string; verifyId?: number }>;
  boardPassengerApi: (pnr: string, passengerNo: number) => Promise<{ success: boolean; message: string }>;
  noShowPassengerApi: (pnr: string, passengerNo: number) => Promise<{ success: boolean; message: string }>;
  promoteRacPassenger: (manifestId: number, vacancyId: number) => ManifestPassenger | null;
  issueFine: (fine: Omit<Fine, 'fineId' | 'receiptNumber' | 'issuedAt'>) => Promise<Fine>;
  updateTrainDelay: (delayMinutes: number, status: Schedule['status'], platform?: number) => Promise<void>;
  addCrowdReport: (report: Omit<CrowdReport, 'crowdReportId' | 'recordedAt'>) => Promise<void>;
  addCleanlinessReport: (report: Omit<CleanlinessReport, 'reportId' | 'createdAt' | 'status'>) => Promise<void>;
  resolveCleanlinessReport: (reportId: number) => void;
  reportIncident: (incident: Omit<Incident, 'incidentId' | 'createdAt' | 'status'>) => Promise<void>;
  resolveIncident: (incidentId: number) => void;
  createMaintenanceTask: (task: {
    coachId?: number;
    platformId?: number;
    stationId?: number;
    type?: string;
    title: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }) => Promise<{ success: boolean; message: string; maintId?: number }>;
  updateMaintenanceStatus: (maintId: number, status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', completionRemarks?: string) => Promise<{ success: boolean; message: string }>;
  createCounterBooking: (payload: any) => Promise<any>;
  resetData: () => void;
  selectedReceiptFine: Fine | null;
  setSelectedReceiptFine: (fine: Fine | null) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  toasts: Array<{ id: number; msg: string; type: 'success' | 'error' | 'info' }>;
}

const StaffContext = createContext<StaffContextType | null>(null);

export const StaffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_DATA;
    } catch {
      return INITIAL_DATA;
    }
  });

  const [activeStaffId, setActiveStaffId] = useState<number>(1);
  const [currentAssignment, setCurrentAssignment] = useState<StaffAssignment | null>(null);
  const [serverChart, setServerChart] = useState<ChartPassenger[]>([]);
  const [chartStatus, setChartStatus] = useState<{ loading: boolean; error: string | null; prepared: boolean }>({
    loading: false,
    error: null,
    prepared: false
  });
  const [selectedReceiptFine, setSelectedReceiptFine] = useState<Fine | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: 'success' | 'error' | 'info' }>>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }, [data]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Load real assignment & chart on mount and whenever active staff changes
  const refreshAssignmentAndChart = useCallback(async () => {
    try {
      const assignment = await staffApiService.getCurrentAssignment();
      if (assignment) {
        setCurrentAssignment(assignment);

        // If this assignment specifies a scheduleId, fetch the real chart
        if (assignment.scheduleId) {
          setChartStatus({ loading: true, error: null, prepared: false });
          try {
            const chartList = await staffApiService.getScheduleChart(assignment.scheduleId);
            if (chartList && Array.isArray(chartList)) {
              setServerChart(chartList);
              setChartStatus({ loading: false, error: null, prepared: true });

              // Map chartList rows to manifest passengers in state if available
              if (chartList.length > 0) {
                const mappedPassengers: ManifestPassenger[] = chartList.map((c, idx) => ({
                  manifestId: c.snapshotId || (idx + 1000),
                  bookingId: 1000 + idx,
                  pnr: c.pnr,
                  trainId: assignment.scheduleId || 101,
                  journeyDate: new Date().toISOString().split('T')[0],
                  boardingStationId: c.fromStationId || 1,
                  destinationStationId: c.toStationId || 2,
                  passengerId: c.passengerNo || (idx + 1),
                  name: c.passengerName || 'Passenger',
                  age: 30,
                  gender: 'MALE',
                  idProofType: 'GOVT_ID',
                  idProofReference: c.pnr ? `PNR-${c.pnr}` : 'VERIFIED',
                  coachNumber: c.coachNo || null,
                  seatNumber: c.seatNo || null,
                  berthType: c.berthType || null,
                  classType: '3A',
                  quota: 'GN',
                  bookingStatus: (c.status as any) || 'CONFIRMED',
                  boardingStatus: 'NOT_VERIFIED',
                  verificationStatus: 'UNCHECKED',
                  verificationNotes: '',
                  verifiedAt: null
                }));

                setData(prev => {
                  const existingPnrs = new Set(prev.manifest.map(m => m.pnr));
                  const newFromChart = mappedPassengers.filter(m => !existingPnrs.has(m.pnr));
                  return {
                    ...prev,
                    manifest: [...newFromChart, ...prev.manifest]
                  };
                });
              }
            } else {
              setServerChart([]);
              setChartStatus({ loading: false, error: null, prepared: false });
            }
          } catch (chartErr: any) {
            setChartStatus({
              loading: false,
              error: chartErr.message || 'Chart has not been prepared yet',
              prepared: false
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not load current staff assignment from API:', err.message);
    }
  }, []);

  useEffect(() => {
    refreshAssignmentAndChart();
  }, [refreshAssignmentAndChart, activeStaffId]);

  const activeStaff = data.staffList.find(s => s.staffId === activeStaffId) || data.staffList[0];
  const activeTrain = data.trains.find(t => t.trainId === activeStaff.assignedTrainId);
  const activeSchedule = data.schedules.find(s => s.trainId === activeStaff.assignedTrainId);

  const switchStaff = (staffId: number) => {
    setActiveStaffId(staffId);
    const s = data.staffList.find(item => item.staffId === staffId);
    if (s) showToast(`Switched active profile to ${s.name}`, 'info');
  };

  // ─── Real Ticket Verification API Call ────────────────────────────────────
  const verifyPassenger = async (
    pnr: string,
    passengerNo: number,
    result: 'VALID' | 'INVALID' | 'MISMATCH',
    remarks?: string
  ): Promise<{ success: boolean; message: string; verifyId?: number }> => {
    try {
      const res = await staffApiService.verifyTicket({
        pnr,
        passengerNo,
        idChecked: true,
        concessionChecked: true,
        result,
        remarks: remarks || `Verification recorded by TC ${activeStaff.name}`
      });
      showToast(`Verification stamped: ${result} (ID: ${res.verifyId})`, 'success');
      return { success: true, message: 'Ticket verification recorded successfully', verifyId: res.verifyId };
    } catch (err: any) {
      showToast(`Verification API error: ${err.message}`, 'error');
      return { success: false, message: err.message };
    }
  };

  // ─── Real Boarding API Call ───────────────────────────────────────────────
  const boardPassengerApi = async (pnr: string, passengerNo: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await staffApiService.boardPassenger(pnr, passengerNo);
      showToast(`Boarding confirmed: PNR ${pnr} Pax #${passengerNo} (${res.status})`, 'success');
      return { success: true, message: `Status: ${res.status}` };
    } catch (err: any) {
      showToast(`Boarding failed: ${err.message}`, 'error');
      return { success: false, message: err.message };
    }
  };

  // ─── Real No-Show API Call ────────────────────────────────────────────────
  const noShowPassengerApi = async (pnr: string, passengerNo: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await staffApiService.markNoShow(pnr, passengerNo);
      showToast(`No-show marked: PNR ${pnr} Pax #${passengerNo}. Seat released! (${res.status})`, 'error');
      return { success: true, message: `Status: ${res.status}` };
    } catch (err: any) {
      showToast(`No-show failed: ${err.message}`, 'error');
      return { success: false, message: err.message };
    }
  };

  // Dual Action: Calls real API if passenger has PNR and passengerNo, then updates state
  const markPassengerBoarding = async (
    manifestId: number,
    status: BoardingStatus,
    verifyStatus?: VerificationStatus,
    notes?: string
  ) => {
    const targetPassenger = data.manifest.find(p => p.manifestId === manifestId);

    if (targetPassenger) {
      const pnr = targetPassenger.pnr;
      const passengerNo = targetPassenger.passengerId || 1;

      if (verifyStatus && (verifyStatus === 'VALID' || verifyStatus === 'INVALID' || verifyStatus === 'MISMATCH')) {
        await verifyPassenger(pnr, passengerNo, verifyStatus, notes);
      }

      if (status === 'BOARDED') {
        const boardRes = await boardPassengerApi(pnr, passengerNo);
        if (!boardRes.success) {
          return; // Do NOT update state if server refused boarding
        }
      } else if (status === 'NO_SHOW') {
        const noShowRes = await noShowPassengerApi(pnr, passengerNo);
        if (!noShowRes.success) {
          return; // Do NOT update state if server refused no-show
        }
      }
    }

    setData(prev => {
      const nextManifest = prev.manifest.map(p => {
        if (p.manifestId === manifestId) {
          return {
            ...p,
            boardingStatus: status,
            verificationStatus: verifyStatus !== undefined ? verifyStatus : p.verificationStatus,
            verificationNotes: notes !== undefined ? notes : p.verificationNotes,
            verifiedAt: new Date().toISOString()
          };
        }
        return p;
      });

      let nextVacancies = [...prev.vacancies];
      if (status === 'NO_SHOW' && targetPassenger && targetPassenger.coachNumber && targetPassenger.seatNumber) {
        const exists = nextVacancies.some(
          v => v.trainId === targetPassenger.trainId &&
               v.coachNumber === targetPassenger.coachNumber &&
               v.seatNumber === targetPassenger.seatNumber
        );
        if (!exists) {
          nextVacancies.unshift({
            vacancyId: Date.now(),
            trainId: targetPassenger.trainId,
            coachNumber: targetPassenger.coachNumber,
            seatNumber: targetPassenger.seatNumber,
            berthType: targetPassenger.berthType || 'LOWER',
            reason: `NO_SHOW (${targetPassenger.name} at Seat ${targetPassenger.coachNumber}-${targetPassenger.seatNumber})`,
            availableFromStationId: targetPassenger.boardingStationId,
            availableToStationId: targetPassenger.destinationStationId
          });
        }
      }

      return {
        ...prev,
        manifest: nextManifest,
        vacancies: nextVacancies
      };
    });
  };

  const promoteRacPassenger = (manifestId: number, vacancyId: number) => {
    const vacancy = data.vacancies.find(v => v.vacancyId === vacancyId);
    const passenger = data.manifest.find(m => m.manifestId === manifestId);
    if (!vacancy || !passenger) return null;

    let updatedPassenger: ManifestPassenger | null = null;

    setData(prev => {
      const nextManifest = prev.manifest.map(p => {
        if (p.manifestId === manifestId) {
          updatedPassenger = {
            ...p,
            coachNumber: vacancy.coachNumber,
            seatNumber: vacancy.seatNumber,
            berthType: vacancy.berthType,
            bookingStatus: 'CONFIRMED' as const,
            verificationNotes: `Promoted from ${p.bookingStatus} by TC to confirmed berth.`
          };
          return updatedPassenger;
        }
        return p;
      });

      const nextVacancies = prev.vacancies.filter(v => v.vacancyId !== vacancyId);
      return {
        ...prev,
        manifest: nextManifest,
        vacancies: nextVacancies
      };
    });

    showToast(`Successfully promoted ${passenger.name} to Confirmed Berth ${vacancy.coachNumber}-${vacancy.seatNumber}!`, 'success');
    return updatedPassenger;
  };

  // ─── Real Fine API Call ───────────────────────────────────────────────────
  const issueFine = async (fineInput: Omit<Fine, 'fineId' | 'receiptNumber' | 'issuedAt'>): Promise<Fine> => {
    let serverFineId: number | undefined;

    // Map reason to allowed backend reason
    const allowedReasons: Record<string, 'TICKETLESS_TRAVEL' | 'UNAUTHORIZED_CLASS' | 'SMOKING_NUISANCE' | 'UNBOOKED_LUGGAGE'> = {
      TICKETLESS_TRAVEL: 'TICKETLESS_TRAVEL',
      TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE: 'UNAUTHORIZED_CLASS',
      UNBOOKED_EXCESS_LUGGAGE: 'UNBOOKED_LUGGAGE',
      SMOKING_NUISANCE: 'SMOKING_NUISANCE',
      IRREGULAR_TICKET: 'TICKETLESS_TRAVEL'
    };
    const mappedReason = allowedReasons[fineInput.reason] || 'TICKETLESS_TRAVEL';

    try {
      const res = await staffApiService.issueFine({
        passengerName: fineInput.passengerName,
        idProofReference: fineInput.idProofReference,
        trainId: fineInput.trainId,
        reason: mappedReason,
        amount: fineInput.amount,
        paymentStatus: fineInput.paymentStatus
      });
      if (res && res.fineId) {
        serverFineId = res.fineId;
      }
    } catch (err: any) {
      showToast(`Warning: Fine server persistence failed (${err.message}). Recording locally.`, 'error');
    }

    const fineId = serverFineId || Date.now();
    const receiptNumber = `FINE-${new Date().getFullYear()}-${fineInput.trainId || 'STN'}-${fineId}`;
    const newFine: Fine = {
      fineId,
      receiptNumber,
      issuedAt: new Date().toISOString(),
      ...fineInput
    };

    setData(prev => ({
      ...prev,
      fines: [newFine, ...prev.fines]
    }));

    showToast(`Penalty Challan #${receiptNumber} issued!`, 'success');
    setSelectedReceiptFine(newFine);
    return newFine;
  };

  // ─── Real Train Delay API Call ────────────────────────────────────────────
  const updateTrainDelay = async (delayMinutes: number, status: Schedule['status'], platform?: number) => {
    const scheduleId = currentAssignment?.scheduleId || activeSchedule?.scheduleId || 1001;

    try {
      await staffApiService.logDelay({
        scheduleId,
        delayMinutes
      });
      showToast(`Server updated: Schedule #${scheduleId} delay set to ${delayMinutes} min`, 'success');
    } catch (err: any) {
      showToast(`Delay server update: ${err.message}`, 'info');
    }

    const trainId = activeStaff.assignedTrainId || 101;
    setData(prev => {
      const nextSchedules = prev.schedules.map(s => {
        if (s.trainId === trainId) {
          return {
            ...s,
            delayMinutes,
            status,
            platformNumber: platform !== undefined ? platform : s.platformNumber
          };
        }
        return s;
      });
      return { ...prev, schedules: nextSchedules };
    });
  };

  // ─── Real Crowd Report API Call ───────────────────────────────────────────
  const addCrowdReport = async (reportInput: Omit<CrowdReport, 'crowdReportId' | 'recordedAt'>) => {
    let serverReportId: number | undefined;

    try {
      const res = await staffApiService.reportCrowd({
        stationId: reportInput.stationId,
        platformNo: reportInput.platformNumber,
        crowdLevel: reportInput.crowdLevel,
        headCount: reportInput.headCount
      });
      if (res && res.crowdReportId) serverReportId = res.crowdReportId;
      showToast('Platform crowd assessment recorded on server!', 'success');
    } catch (err: any) {
      showToast(`Crowd API notification: ${err.message}`, 'info');
    }

    const report: CrowdReport = {
      crowdReportId: serverReportId || Date.now(),
      recordedAt: new Date().toISOString(),
      ...reportInput
    };
    setData(prev => ({
      ...prev,
      crowdReports: [report, ...prev.crowdReports]
    }));
  };

  // ─── Real Cleanliness Report API Call ─────────────────────────────────────
  const addCleanlinessReport = async (cleanInput: Omit<CleanlinessReport, 'reportId' | 'createdAt' | 'status'>) => {
    let serverCleanId: number | undefined;

    const allowedCleanlinessIssues: Record<string, 'TOILET_DIRTY' | 'LITTER' | 'WATER_SHORTAGE' | 'LINEN_SOILED' | 'PESTS' | 'SPILLAGE'> = {
      TOILET_DIRTY: 'TOILET_DIRTY',
      LITTER: 'LITTER',
      WATER_SHORTAGE: 'WATER_SHORTAGE',
      LINEN_SOILED: 'LINEN_SOILED',
      PESTS: 'PESTS',
      SPILLAGE: 'SPILLAGE'
    };
    const mappedIssue = allowedCleanlinessIssues[cleanInput.issueType] || 'TOILET_DIRTY';

    try {
      const res = await staffApiService.reportCleanliness({
        trainId: cleanInput.trainId || null,
        coachId: cleanInput.coachId || null,
        stationId: cleanInput.stationId || null,
        platformNo: cleanInput.platformNumber || null,
        issueType: mappedIssue,
        description: cleanInput.description
      });
      if (res && res.reportId) serverCleanId = res.reportId;
      showToast('Housekeeping ticket dispatched on server!', 'success');
    } catch (err: any) {
      showToast(`Cleanliness API notice: ${err.message}`, 'info');
    }

    const report: CleanlinessReport = {
      reportId: serverCleanId || Date.now(),
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      ...cleanInput
    };
    setData(prev => ({
      ...prev,
      cleanlinessReports: [report, ...prev.cleanlinessReports]
    }));
  };

  const resolveCleanlinessReport = (reportId: number) => {
    setData(prev => ({
      ...prev,
      cleanlinessReports: prev.cleanlinessReports.map(r => r.reportId === reportId ? { ...r, status: 'RESOLVED' as const } : r)
    }));
    showToast(`Housekeeping ticket #${reportId} resolved.`, 'success');
  };

  // ─── Real Incident SOS API Call ───────────────────────────────────────────
  const reportIncident = async (incInput: Omit<Incident, 'incidentId' | 'createdAt' | 'status'>) => {
    let serverIncId: number | undefined;

    try {
      const res = await staffApiService.reportIncident({
        scheduleId: currentAssignment?.scheduleId || null,
        stationId: incInput.stationId || null,
        type: incInput.type,
        severity: incInput.severity
      });
      if (res && res.incidentId) serverIncId = res.incidentId;
      showToast('EMERGENCY SOS ALERT TRANSMITTED to Control Office!', 'error');
    } catch (err: any) {
      showToast(`SOS dispatch warning: ${err.message}`, 'error');
    }

    const inc: Incident = {
      incidentId: serverIncId || Date.now(),
      createdAt: new Date().toISOString(),
      status: 'ACKNOWLEDGED',
      ...incInput
    };
    setData(prev => ({
      ...prev,
      incidents: [inc, ...prev.incidents]
    }));
  };

  const resolveIncident = (incidentId: number) => {
    setData(prev => ({
      ...prev,
      incidents: prev.incidents.map(i => i.incidentId === incidentId ? { ...i, status: 'RESOLVED' as const } : i)
    }));
    showToast(`Incident #${incidentId} resolved.`, 'success');
  };

  // ─── Maintenance Tasks API Integration ────────────────────────────────────
  const createMaintenanceTask = async (task: {
    coachId?: number;
    platformId?: number;
    stationId?: number;
    type?: string;
    title: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): Promise<{ success: boolean; message: string; maintId?: number }> => {
    try {
      const res = await staffApiService.createMaintenanceTask({
        coachId: task.coachId,
        platformId: task.platformId,
        type: task.type || task.title,
        description: task.description
      });
      showToast(`Maintenance task created: #${res.maintId}`, 'success');
      return { success: true, message: res.message || 'Task created', maintId: res.maintId };
    } catch (err: any) {
      showToast(`Maintenance error: ${err.message}`, 'error');
      return { success: false, message: err.message };
    }
  };

  const updateMaintenanceStatus = async (
    maintId: number,
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    completionRemarks?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await staffApiService.updateMaintenanceTaskStatus(maintId, status, completionRemarks);
      showToast(`Maintenance #${maintId} updated to ${status}`, 'success');
      return { success: true, message: res.message || 'Status updated' };
    } catch (err: any) {
      showToast(`Maintenance status error: ${err.message}`, 'error');
      return { success: false, message: err.message };
    }
  };

  // ─── Counter Booking API Integration ──────────────────────────────────────
  const createCounterBooking = async (payload: any): Promise<any> => {
    try {
      const res = await staffApiService.createCounterBooking(payload);
      showToast(`Counter ticket generated! PNR: ${res.booking?.pnr || 'SUCCESS'}`, 'success');
      return res;
    } catch (err: any) {
      showToast(`Counter booking failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const resetData = () => {
    setData(INITIAL_DATA);
    refreshAssignmentAndChart();
    showToast('All state refreshed from server and defaults.', 'info');
  };

  return (
    <StaffContext.Provider
      value={{
        data,
        activeStaffId,
        activeStaff,
        activeTrain,
        activeSchedule,
        currentAssignment,
        serverChart,
        chartStatus,
        switchStaff,
        refreshAssignmentAndChart,
        markPassengerBoarding,
        verifyPassenger,
        boardPassengerApi,
        noShowPassengerApi,
        promoteRacPassenger,
        issueFine,
        updateTrainDelay,
        addCrowdReport,
        addCleanlinessReport,
        resolveCleanlinessReport,
        reportIncident,
        resolveIncident,
        createMaintenanceTask,
        updateMaintenanceStatus,
        createCounterBooking,
        resetData,
        selectedReceiptFine,
        setSelectedReceiptFine,
        showToast,
        toasts
      }}
    >
      {children}
    </StaffContext.Provider>
  );
};

export const useStaff = () => {
  const context = useContext(StaffContext);
  if (!context) throw new Error('useStaff must be used within a StaffProvider');
  return context;
};
