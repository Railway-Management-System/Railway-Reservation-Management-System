const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const xlsx = require('xlsx');
const {
  SEED_MYSQL_DIR,
  DATASETS_DIR,
  MOCK_DATA_DIR,
  escapeCsv,
  writeCsv,
  createRng
} = require('./helpers');

// Salted hash helper (fast scrypt)
function hashPassword(pwd, salt) {
  return crypto.scryptSync(pwd, salt, 32, { N: 16, r: 8, p: 1 }).toString('hex');
}

// Title case helper for station names
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => {
    if (w === 'jn' || w === 'jn.' || w === 'junction') return 'Jn';
    if (w === 'cantt' || w === 'cantt.') return 'Cantt';
    if (w === 'term' || w === 'terminus') return 'Terminus';
    if (w === 'central') return 'Central';
    if (w.length === 0) return '';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ').replace(/\s+/g, ' ').trim();
}

async function cleanStep1() {
  console.log('=== Step 1: Cleaning Datasets ===');

  // 1. STATIONS & PLATFORMS
  console.log('Cleaning stations and generating platforms...');
  const wbStations = xlsx.readFile(path.join(DATASETS_DIR, 'stations_158_final.xlsx'));
  const rawStations = xlsx.utils.sheet_to_json(wbStations.Sheets[wbStations.SheetNames[0]]);
  
  const targetStations = ['BMT', 'DPU', 'FKG', 'SRTN', 'MRHT', 'KNE', 'UD', 'KAWR'];
  const stationRows = [];
  const platformRows = [];
  let platformIdCounter = 1;

  for (const s of rawStations) {
    let pCount = parseInt(s.platformNo, 10);
    if (targetStations.includes(s.stationCode)) {
      pCount = 3;
    }
    const displayName = toTitleCase(s.stationName);
    
    stationRows.push({
      station_id: s.stationId,
      station_code: s.stationCode,
      station_name: s.stationName,
      display_name: displayName,
      city: s.City,
      state: s.State,
      platform_count: pCount
    });

    for (let p = 1; p <= pCount; p++) {
      platformRows.push({
        platform_id: platformIdCounter++,
        station_id: s.stationId,
        platform_no: p
      });
    }
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'STATION.csv'),
    ['station_id', 'station_code', 'station_name', 'display_name', 'city', 'state', 'platform_count'],
    stationRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'PLATFORM.csv'),
    ['platform_id', 'station_id', 'platform_no'],
    platformRows
  );
  console.log(`STATION.csv written (${stationRows.length} rows), PLATFORM.csv written (${platformRows.length} rows)`);

  // 2. TRAINS
  console.log('Cleaning trains...');
  const wbTrains = xlsx.readFile(path.join(DATASETS_DIR, 'final_trains_60.xlsx'));
  const rawTrains = xlsx.utils.sheet_to_json(wbTrains.Sheets[wbTrains.SheetNames[0]]);

  const rajTypes = [117, 118, 125, 126, 127, 128, 132, 135, 136];
  const shatTypes = [139, 140, 141, 142, 145, 146, 147, 148, 151, 152];
  const durTypes = [105, 106, 157, 158];

  const trainNamesMap = {
    101: 'Pune–Howrah Duronto Express',
    102: 'Howrah–Pune Duronto Express',
    103: 'Ernakulam Duronto Express',
    104: 'Ernakulam Duronto Express',
    105: 'Howrah–Yesvantpur Duronto Express',
    106: 'Yesvantpur–Howrah Duronto Express',
    107: 'Mumbai–Howrah Duronto Express',
    108: 'Howrah–Mumbai Duronto Express',
    109: 'Chennai–Nizamuddin Duronto Express',
    110: 'Nizamuddin–Chennai Duronto Express',
    111: 'Howrah Rajdhani Express',
    112: 'Howrah Rajdhani Express',
    113: 'Patna Rajdhani Express',
    114: 'Patna Rajdhani Express',
    115: 'Sealdah Rajdhani Express',
    116: 'Sealdah Rajdhani Express',
    117: 'Dibrugarh Rajdhani Express',
    118: 'Dibrugarh Rajdhani Express',
    119: 'Thiruvananthapuram Rajdhani Express',
    120: 'Thiruvananthapuram Rajdhani Express',
    121: 'Chennai Rajdhani Express',
    122: 'Chennai Rajdhani Express',
    123: 'Secunderabad Rajdhani Express',
    124: 'Secunderabad Rajdhani Express',
    125: 'Bilaspur Rajdhani Express',
    126: 'Bilaspur Rajdhani Express',
    127: 'Ranchi Rajdhani Express',
    128: 'Ranchi Rajdhani Express',
    129: 'Mumbai Rajdhani Express',
    130: 'Mumbai Rajdhani Express',
    131: 'August Kranti Rajdhani Express',
    132: 'August Kranti Rajdhani Express',
    133: 'Swarna Jayanti Rajdhani Express',
    134: 'Swarna Jayanti Rajdhani Express',
    135: 'Bengaluru Rajdhani Express',
    136: 'Bengaluru Rajdhani Express',
    137: 'Bhubaneswar Rajdhani Express',
    138: 'Bhubaneswar Rajdhani Express',
    139: 'Bhopal Shatabdi Express',
    140: 'Bhopal Shatabdi Express',
    141: 'Lucknow Swarna Shatabdi Express',
    142: 'Lucknow Swarna Shatabdi Express',
    143: 'Mumbai–Ahmedabad Shatabdi Express',
    144: 'Ahmedabad–Mumbai Shatabdi Express',
    145: 'Amritsar Shatabdi Express',
    146: 'Amritsar Shatabdi Express',
    147: 'Dehradun Shatabdi Express',
    148: 'Dehradun Shatabdi Express',
    149: 'Pune–Secunderabad Shatabdi Express',
    150: 'Secunderabad–Pune Shatabdi Express',
    151: 'Guwahati–Dibrugarh Jan Shatabdi Express',
    152: 'Dibrugarh–Guwahati Jan Shatabdi Express',
    153: 'Mysuru Shatabdi Express',
    154: 'Mysuru Shatabdi Express',
    155: 'Bengaluru Shatabdi Express',
    156: 'Bengaluru Shatabdi Express',
    157: 'Secunderabad AC Duronto Express',
    158: 'Secunderabad AC Duronto Express',
    159: 'Jammu Rajdhani Express',
    160: 'Jammu Rajdhani Express'
  };

  const trainRows = [];
  for (const t of rawTrains) {
    let tType = t.trainType;
    if (rajTypes.includes(t.trainId)) tType = 'RAJDHANI';
    else if (shatTypes.includes(t.trainId)) tType = 'SHATABDI';
    else if (durTypes.includes(t.trainId)) tType = 'DURONTO';

    const baseName = trainNamesMap[t.trainId] || t.trainName;
    const displayName = `${baseName} (${t.trainNumber})`;

    // runningDays is already JSON string of array
    trainRows.push({
      train_id: t.trainId,
      train_number: t.trainNumber,
      short_name: t.trainName,
      display_name: displayName,
      train_type: tType,
      source_station_id: t.sourceStationId,
      destination_station_id: t.destinationStationId,
      running_days: t.runningDays,
      status: t.status
    });
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'TRAIN.csv'),
    ['train_id', 'train_number', 'short_name', 'display_name', 'train_type', 'source_station_id', 'destination_station_id', 'running_days', 'status'],
    trainRows
  );
  console.log(`TRAIN.csv written (${trainRows.length} rows)`);

  // 3. ROUTES
  console.log('Cleaning routes and calculating day_offset...');
  const wbRoutes = xlsx.readFile(path.join(DATASETS_DIR, 'final_routes_536.xlsx'));
  const rawRoutes = xlsx.utils.sheet_to_json(wbRoutes.Sheets[wbRoutes.SheetNames[0]]);

  function toMin(t) {
    if (typeof t === 'number') return Math.round(t * 24 * 60);
    const p = String(t).split(':').map(Number);
    return p[0] * 60 + (p[1] || 0);
  }

  const byTrain = {};
  for (const r of rawRoutes) {
    if (!byTrain[r.trainId]) byTrain[r.trainId] = [];
    byTrain[r.trainId].push(r);
  }

  const routeRows = [];
  for (const [tId, stops] of Object.entries(byTrain)) {
    stops.sort((a,b) => a.stopSequence - b.stopSequence);

    // Fix first stop arrival
    if (stops[0].arrivalTime === '00:00' || stops[0].arrivalTime === '00:00:00') {
      stops[0].arrivalTime = stops[0].departureTime;
    }
    // Fix last stop departure
    const last = stops[stops.length - 1];
    if (last.departureTime === '00:00' || last.departureTime === '00:00:00') {
      last.departureTime = last.arrivalTime;
    }

    let currentOffset = 0;
    let prevAbsTime = toMin(stops[0].departureTime);
    stops[0].day_offset = 0;

    for (let i = 1; i < stops.length; i++) {
      let arrAbs = currentOffset * 1440 + toMin(stops[i].arrivalTime);
      if (arrAbs < prevAbsTime) {
        currentOffset++;
        arrAbs += 1440;
      }
      stops[i].day_offset = currentOffset;

      let depAbs = currentOffset * 1440 + toMin(stops[i].departureTime);
      if (depAbs < arrAbs) {
        currentOffset++;
        depAbs += 1440;
        stops[i].day_offset = currentOffset;
      }
      prevAbsTime = depAbs;
    }

    for (const s of stops) {
      routeRows.push({
        stop_id: s.routeId,
        train_id: s.trainId,
        station_id: s.stationId,
        stop_sequence: s.stopSequence,
        arrival_time: s.arrivalTime.length === 5 ? s.arrivalTime + ':00' : s.arrivalTime,
        departure_time: s.departureTime.length === 5 ? s.departureTime + ':00' : s.departureTime,
        day_offset: s.day_offset,
        distance_from_origin: s.distanceFromOrigin,
        platform_number: s.platformNumber
      });
    }
  }

  routeRows.sort((a,b) => a.stop_id - b.stop_id);
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'ROUTE_STOP.csv'),
    ['stop_id', 'train_id', 'station_id', 'stop_sequence', 'arrival_time', 'departure_time', 'day_offset', 'distance_from_origin', 'platform_number'],
    routeRows
  );
  console.log(`ROUTE_STOP.csv written (${routeRows.length} rows)`);

  // 4. PASSENGERS
  console.log('Cleaning passengers...');
  const passRl = readline.createInterface({
    input: fs.createReadStream(path.join(DATASETS_DIR, 'passengers_synthetic_2.csv')),
    crlfDelay: Infinity
  });

  const passRows = [];
  const passengerNames = [];
  let pIdx = 0;
  for await (const line of passRl) {
    if (pIdx > 0) {
      const parts = line.split(',');
      const passengerId = parseInt(parts[0], 10);
      const userId = parseInt(parts[1], 10);
      const name = parts[2];
      const age = parseInt(parts[3], 10);
      
      if (passengerNames.length < 50000) {
        passengerNames.push(name);
      }

      // Realistic gender split: 50% MALE, 49% FEMALE, 1% OTHER
      const h = ((passengerId * 2654435761) >>> 0) % 1000;
      let gender = 'MALE';
      if (h < 10) gender = 'OTHER';
      else if (h < 500) gender = 'FEMALE';
      else gender = 'MALE';

      const idProofType = parts[5];
      // Guarantee unique idProofReference
      const idProofReference = `${parts[6]}-${passengerId}`;

      // Disability type: about 2% have disability type
      let disabilityType = parts[7];
      if (disabilityType !== 'NONE' && ((passengerId % 50) !== 0)) {
        // limit to ~2%
        disabilityType = 'NONE';
      } else if (disabilityType === 'NONE' && (passengerId % 50 === 0)) {
        disabilityType = 'ORTHOPEDIC';
      }

      // Concession: only NONE or DIVYAANG
      let concessionType = 'NONE';
      if (disabilityType !== 'NONE') {
        concessionType = 'DIVYAANG';
      }

      let berthPreference = parts[9];
      if (berthPreference === 'WINDOW') {
        // default to LOWER if in non-chair class, or keep as valid enum
        berthPreference = 'LOWER';
      }

      passRows.push({
        passenger_id: passengerId,
        user_id: userId,
        name: name,
        age: age,
        gender: gender,
        id_proof_type: idProofType,
        id_proof_reference: idProofReference,
        disability_type: disabilityType,
        berth_preference: berthPreference
      });
    }
    pIdx++;
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SAVED_PASSENGER.csv'),
    ['passenger_id', 'user_id', 'name', 'age', 'gender', 'id_proof_type', 'id_proof_reference', 'disability_type', 'berth_preference'],
    passRows
  );
  console.log(`SAVED_PASSENGER.csv written (${passRows.length} rows)`);

  // 5. USERS
  console.log('Cleaning users and generating extra roles...');
  const userRl = readline.createInterface({
    input: fs.createReadStream(path.join(DATASETS_DIR, 'users_synthetic_2.csv')),
    crlfDelay: Infinity
  });

  const userRows = [];
  const usedPhones = new Set();
  let uIdx = 0;
  for await (const line of userRl) {
    if (uIdx > 0) {
      const parts = line.split(',');
      const userId = parseInt(parts[0], 10);
      const email = parts[1];
      let phone = parts[3];

      if (usedPhones.has(phone)) {
        phone = `+91-987${String(1000000 + userId).slice(-7)}`;
      }
      usedPhones.add(phone);

      const name = passengerNames[userId - 1] || `User ${userId}`;
      const role = 'PASSENGER';
      const accountStatus = (userId % 100 === 0) ? 'INACTIVE' : 'ACTIVE';
      const aadhaarVerified = (userId % 5 < 2) ? 1 : 0; // ~40% true

      const salt = `salt_user_${userId}`;
      const passwordHash = hashPassword('Password123!', salt);

      userRows.push({
        user_id: userId,
        email: email,
        password_hash: passwordHash,
        phone: phone,
        full_name: name,
        role: role,
        account_status: accountStatus,
        aadhaar_verified: aadhaarVerified,
        created_at: parts[4]
      });
    }
    uIdx++;
  }

  // Extra users after 50000
  // Rahul Sharma (50001)
  userRows.push({
    user_id: 50001,
    email: 'rahul.sharma@example.com',
    password_hash: hashPassword('Password123!', 'salt_user_50001'),
    phone: '+91-9876543210',
    full_name: 'Rahul Sharma',
    role: 'PASSENGER',
    account_status: 'ACTIVE',
    aadhaar_verified: 1,
    created_at: '2026-01-15 10:30:00'
  });

  // Priya Patel (50002)
  userRows.push({
    user_id: 50002,
    email: 'priya.patel@example.com',
    password_hash: hashPassword('Password123!', 'salt_user_50002'),
    phone: '+91-9876543211',
    full_name: 'Priya Patel',
    role: 'PASSENGER',
    account_status: 'ACTIVE',
    aadhaar_verified: 0,
    created_at: '2026-02-20 11:45:00'
  });

  // Amit Verma (50003)
  userRows.push({
    user_id: 50003,
    email: 'amit.verma@example.com',
    password_hash: hashPassword('Password123!', 'salt_user_50003'),
    phone: '+91-9876543212',
    full_name: 'Amit Verma',
    role: 'PASSENGER',
    account_status: 'SUSPENDED',
    aadhaar_verified: 0,
    created_at: '2026-03-05 09:15:00'
  });

  // Vikram Singh (Staff 50004)
  userRows.push({
    user_id: 50004,
    email: 'vikram.singh@railways.gov.in',
    password_hash: hashPassword('StaffPassword123!', 'salt_user_50004'),
    phone: '+91-9876543213',
    full_name: 'Vikram Singh',
    role: 'STAFF',
    account_status: 'ACTIVE',
    aadhaar_verified: 1,
    created_at: '2025-11-10 08:00:00'
  });

  // Sunita Rao (Staff 50005)
  userRows.push({
    user_id: 50005,
    email: 'sunita.rao@railways.gov.in',
    password_hash: hashPassword('StaffPassword123!', 'salt_user_50005'),
    phone: '+91-9876543214',
    full_name: 'Sunita Rao',
    role: 'STAFF',
    account_status: 'ACTIVE',
    aadhaar_verified: 1,
    created_at: '2025-11-12 08:30:00'
  });

  // Ramesh Nair (Staff 50006)
  userRows.push({
    user_id: 50006,
    email: 'ramesh.nair@railways.gov.in',
    password_hash: hashPassword('StaffPassword123!', 'salt_user_50006'),
    phone: '+91-9876543215',
    full_name: 'Ramesh Nair',
    role: 'STAFF',
    account_status: 'ACTIVE',
    aadhaar_verified: 1,
    created_at: '2025-12-01 09:00:00'
  });

  // Rajesh Gupta (Admin 50007)
  userRows.push({
    user_id: 50007,
    email: 'admin@railways.gov.in',
    password_hash: hashPassword('AdminPassword123!', 'salt_user_50007'),
    phone: '+91-9876543216',
    full_name: 'Rajesh Gupta',
    role: 'ADMIN',
    account_status: 'ACTIVE',
    aadhaar_verified: 1,
    created_at: '2025-10-01 00:00:00'
  });

  // COUNTER_WALKIN (50008)
  userRows.push({
    user_id: 50008,
    email: 'counter_walkin@railways.gov.in',
    password_hash: hashPassword('CounterWalkin123!', 'salt_user_50008'),
    phone: '+91-9000000000',
    full_name: 'COUNTER_WALKIN',
    role: 'PASSENGER',
    account_status: 'ACTIVE',
    aadhaar_verified: 0,
    created_at: '2025-10-01 00:00:00'
  });

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'USER_ACCOUNT.csv'),
    ['user_id', 'email', 'password_hash', 'phone', 'full_name', 'role', 'account_status', 'aadhaar_verified', 'created_at'],
    userRows
  );
  console.log(`USER_ACCOUNT.csv written (${userRows.length} rows)`);
  console.log('=== Step 1 Complete ===\n');
}

if (require.main === module) {
  cleanStep1().catch(console.error);
}

module.exports = { cleanStep1 };
