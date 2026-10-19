const fs = require('fs');
const path = require('path');
const {
  SEED_MYSQL_DIR,
  SEED_MONGODB_DIR,
  MOCK_DATA_DIR,
  writeCsv,
  writeJson
} = require('./helpers');

function remapStep2() {
  console.log('=== Step 2: Remapping Mock Data ===');

  // Station mapping
  const stationMap = {
    'NDLS': 10,
    'CNB': 12,
    'PNBE': 90,
    'HWH': 69,
    'BCT': 21,
    'ST': 24,
    'BRC': 26,
    'ADI': 29,
    'MAS': 17,
    'SBC': 19,
    1: 10, // NDLS in old mock was station 1
    7: 21  // BCT/CSMT in old mock was station 7
  };

  // Train mapping
  const trainMap = {
    12951: 129,
    12952: 130,
    12301: 111,
    12302: 112,
    12002: 140,
    12007: 153,
    101: 129, // remap old mock trainId 101 to Mumbai Rajdhani (129)
    110: 110  // 110 is Nizamuddin-Chennai Duronto (valid trainId)
  };

  // Staff User mapping (Staff in USER_ACCOUNT are 50004, 50005, 50006)
  const staffUserIdMap = {
    1: 50004,
    2: 50005,
    3: 50006,
    4: 50004,
    5: 50005,
    6: 50006
  };

  // 1. STAFF table (MySQL)
  console.log('Generating STAFF and STAFF_ASSIGNMENT tables...');
  const staffRows = [
    {
      staff_id: 1,
      user_id: 50004,
      employee_no: 'EMP-TC-101',
      designation: 'Ticket Collector (TC)',
      status: 'ACTIVE'
    },
    {
      staff_id: 2,
      user_id: 50005,
      employee_no: 'EMP-TC-102',
      designation: 'Station Superintendent',
      status: 'ACTIVE'
    },
    {
      staff_id: 3,
      user_id: 50006,
      employee_no: 'EMP-TC-103',
      designation: 'Platform Inspector',
      status: 'ACTIVE'
    }
  ];

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'STAFF.csv'),
    ['staff_id', 'user_id', 'employee_no', 'designation', 'status'],
    staffRows
  );

  // STAFF_ASSIGNMENT (MySQL)
  const staffAssignmentRows = [
    {
      assign_id: 1,
      staff_id: 1,
      schedule_id: 1001,
      station_id: 21,
      duty_type: 'TRAIN_DUTY',
      shift_start: '2026-10-18 06:00:00',
      shift_end: '2026-10-18 14:00:00'
    },
    {
      assign_id: 2,
      staff_id: 2,
      schedule_id: null,
      station_id: 10,
      duty_type: 'STATION_DUTY',
      shift_start: '2026-10-18 08:00:00',
      shift_end: '2026-10-18 16:00:00'
    },
    {
      assign_id: 3,
      staff_id: 3,
      schedule_id: null,
      station_id: 10,
      duty_type: 'COUNTER_DUTY',
      shift_start: '2026-10-18 09:00:00',
      shift_end: '2026-10-18 17:00:00'
    }
  ];

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'STAFF_ASSIGNMENT.csv'),
    ['assign_id', 'staff_id', 'schedule_id', 'station_id', 'duty_type', 'shift_start', 'shift_end'],
    staffAssignmentRows
  );

  // 2. ADMIN table (MySQL)
  console.log('Generating ADMIN table...');
  const adminRows = [
    {
      admin_id: 1,
      user_id: 50007,
      employee_no: 'ADM-NDLS-001',
      access_level: 'SUPER_ADMIN'
    }
  ];

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'ADMIN.csv'),
    ['admin_id', 'user_id', 'employee_no', 'access_level'],
    adminRows
  );

  // 3. REPORT table (MySQL)
  const reportRows = [
    {
      report_id: 1,
      admin_id: 1,
      report_type: 'REVENUE',
      generated_at: '2026-10-17 18:00:00'
    },
    {
      report_id: 2,
      admin_id: 1,
      report_type: 'OCCUPANCY',
      generated_at: '2026-10-17 18:30:00'
    }
  ];

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'REPORT.csv'),
    ['report_id', 'admin_id', 'report_type', 'generated_at'],
    reportRows
  );

  // 4. Remap and write FINES (MySQL)
  console.log('Remapping FINES...');
  const rawFines = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'fines.json'), 'utf8'));
  const fineRows = [];
  for (const f of rawFines) {
    const tId = trainMap[f.trainId] || 129;
    fineRows.push({
      fine_id: f.fineId,
      verify_id: null,
      staff_id: f.staffId,
      passenger_name: f.passengerName,
      id_proof_reference: f.idProofReference,
      train_id: tId,
      amount: f.amount,
      reason: f.reason === 'TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE' ? 'UNAUTHORIZED_CLASS' : f.reason === 'UNBOOKED_EXCESS_LUGGAGE' ? 'UNBOOKED_LUGGAGE' : f.reason,
      payment_status: f.paymentStatus,
      issued_at: f.issuedAt.replace('T', ' ').replace('Z', '')
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'FINE.csv'),
    ['fine_id', 'verify_id', 'staff_id', 'passenger_name', 'id_proof_reference', 'train_id', 'amount', 'reason', 'payment_status', 'issued_at'],
    fineRows
  );

  // 5. Remap and write INCIDENTS (MySQL)
  console.log('Remapping INCIDENTS...');
  const rawIncidents = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'incidents.json'), 'utf8'));
  const incidentRows = [];
  for (const inc of rawIncidents) {
    const sId = inc.stationId ? (stationMap[inc.stationId] || 10) : null;
    const tId = inc.trainId ? (trainMap[inc.trainId] || 129) : null;
    incidentRows.push({
      incident_id: inc.incidentId,
      staff_id: inc.reportedBy,
      station_id: sId,
      schedule_id: null,
      type: inc.type,
      severity: inc.severity,
      status: inc.status === 'RESOLVED' ? 'RESOLVED' : 'ACKNOWLEDGED',
      reported_at: inc.createdAt.replace('T', ' ').replace('Z', '')
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'INCIDENT.csv'),
    ['incident_id', 'staff_id', 'station_id', 'schedule_id', 'type', 'severity', 'status', 'reported_at'],
    incidentRows
  );

  // 6. Remap and write CROWD_REPORT (MySQL)
  console.log('Remapping CROWD_REPORT...');
  const rawCrowd = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'crowd-reports.json'), 'utf8'));
  const crowdRows = [];
  for (const c of rawCrowd) {
    const sId = stationMap[c.stationId] || 10;
    crowdRows.push({
      crowd_report_id: c.crowdReportId,
      station_id: sId,
      platform_no: c.platformNumber > 3 ? 2 : c.platformNumber,
      crowd_level: c.crowdLevel,
      head_count: c.headCount,
      staff_id: c.recordedBy,
      recorded_at: c.recordedAt.replace('T', ' ').replace('Z', '')
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'CROWD_REPORT.csv'),
    ['crowd_report_id', 'station_id', 'platform_no', 'crowd_level', 'head_count', 'staff_id', 'recorded_at'],
    crowdRows
  );

  // 7. Remap and write CLEANLINESS_REPORT (MySQL)
  console.log('Remapping CLEANLINESS_REPORT...');
  const rawClean = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'cleanliness-reports.json'), 'utf8'));
  const cleanRows = [];
  for (const cl of rawClean) {
    const sId = cl.stationId ? (stationMap[cl.stationId] || 10) : null;
    const tId = cl.trainId ? (trainMap[cl.trainId] || 129) : null;
    cleanRows.push({
      cleanliness_report_id: cl.reportId,
      staff_id: cl.reportedBy,
      train_id: tId,
      coach_id: null,
      station_id: sId,
      platform_no: cl.platformNumber ? (cl.platformNumber > 3 ? 2 : cl.platformNumber) : null,
      issue_type: cl.issueType,
      description: cl.description,
      status: cl.status === 'RESOLVED' ? 'RESOLVED' : 'ATTENDING',
      recorded_at: cl.createdAt.replace('T', ' ').replace('Z', '')
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'CLEANLINESS_REPORT.csv'),
    ['cleanliness_report_id', 'staff_id', 'train_id', 'coach_id', 'station_id', 'platform_no', 'issue_type', 'description', 'status', 'recorded_at'],
    cleanRows
  );

  // 8. Remap and write AUDIT_LOG (MySQL)
  console.log('Remapping AUDIT_LOG...');
  const rawAudit = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'audit-logs.json'), 'utf8'));
  const auditRows = [];
  for (const a of rawAudit) {
    auditRows.push({
      log_id: a.auditId,
      user_id: 50007, // Admin Rajesh Gupta
      action: a.action,
      table_name: a.entityType === 'USER' ? 'USER_ACCOUNT' : a.entityType === 'SCHEDULE' ? 'TRAIN_SCHEDULE' : a.entityType,
      record_id: a.entityId,
      old_value: JSON.stringify(a.oldValue),
      new_value: JSON.stringify(a.newValue),
      logged_at: a.createdAt.replace('T', ' ').replace('Z', '')
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'AUDIT_LOG.csv'),
    ['log_id', 'user_id', 'action', 'table_name', 'record_id', 'old_value', 'new_value', 'logged_at'],
    auditRows
  );

  // 9. Remap MongoDB Collections:
  // - complaints
  // - activity_logs
  console.log('Generating MongoDB collections (complaints, activity_logs)...');
  const rawGrievances = JSON.parse(fs.readFileSync(path.join(MOCK_DATA_DIR, 'grievances.json'), 'utf8'));
  const mongoComplaints = rawGrievances.map(g => ({
    _id: `cmp_${g.grievanceId}`,
    user_id: g.userId === 1 ? 50001 : g.userId === 2 ? 50002 : g.userId,
    type: g.category,
    message: g.description,
    rating: g.status === 'RESOLVED' ? 4 : 2,
    status: g.status,
    extra_fields: {
      subject: g.subject,
      response: g.response
    },
    created_at: g.createdAt
  }));
  writeJson(path.join(SEED_MONGODB_DIR, 'complaints.json'), mongoComplaints);

  const mongoActivity = [
    {
      _id: 'act_1001',
      user_id: 50001,
      event: 'USER_LOGIN',
      ip: '103.21.144.12',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      meta: { channel: 'WEB' },
      at: '2026-10-18T08:30:00Z'
    },
    {
      _id: 'act_1002',
      user_id: 50004,
      event: 'STAFF_DUTY_START',
      ip: '192.168.1.101',
      user_agent: 'Handheld-HHT-v2.1',
      meta: { duty_type: 'TRAIN_DUTY', train_id: 129 },
      at: '2026-10-18T09:00:00Z'
    },
    {
      _id: 'act_1003',
      user_id: 50007,
      event: 'ADMIN_SETTING_UPDATE',
      ip: '10.0.0.5',
      user_agent: 'Mozilla/5.0 (AdminPortal)',
      meta: { setting: 'BOOKING_WINDOW_DAYS', new_value: '7' },
      at: '2026-10-18T09:15:00Z'
    }
  ];
  writeJson(path.join(SEED_MONGODB_DIR, 'activity_logs.json'), mongoActivity);

  console.log('=== Step 2 Complete ===\n');
}

if (require.main === module) {
  remapStep2();
}

module.exports = { remapStep2 };
