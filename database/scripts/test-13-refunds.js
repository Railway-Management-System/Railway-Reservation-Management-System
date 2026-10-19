const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve('database/.env') });

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'railway_db',
        dateStrings: true
    });

    await conn.beginTransaction();

    const v_test_pnr = '9888000001';
    const v_sched_id = 1111;
    const v_class_id = 3;

    await conn.query('INSERT INTO BOOKING (pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id, channel, quota, requested_quota, berth_condition, total_fare, status, created_at) VALUES (?, 50001, ?, ?, 1001, 1005, "ONLINE", "GENERAL", "GENERAL", 0, 3000.00, "CONFIRMED", "2026-10-18 08:00:00")', [v_test_pnr, v_sched_id, v_class_id]);
    await conn.query('INSERT INTO PASSENGER_BOOKING (pnr, passenger_no, saved_passenger_id, name, age, gender, concession_type, base_fare, total_fare, insurance) VALUES (?, 1, 15, "Mixed Pass 1 Conf", 30, "MALE", "NONE", 999.55, 1000.00, 0.45), (?, 2, 16, "Mixed Pass 2 RAC", 28, "FEMALE", "NONE", 999.55, 1000.00, 0.45), (?, 3, 17, "Mixed Pass 3 WL", 25, "MALE", "NONE", 999.55, 1000.00, 0.45)', [v_test_pnr, v_test_pnr, v_test_pnr]);
    await conn.query('INSERT INTO RESERVATION (res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position) VALUES (988801, ?, 1, ?, 17001, "CONFIRMED", NULL), (988802, ?, 2, ?, NULL, "RAC", "RAC/99"), (988803, ?, 3, ?, NULL, "WAITING_LIST", "WL/99")', [v_test_pnr, v_sched_id, v_test_pnr, v_sched_id, v_test_pnr, v_sched_id]);
    await conn.query('INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at) VALUES (988801, ?, 3000.00, "UPI", "SUCCESS", "pay_mixed_test_01", "2026-10-18 08:00:00")', [v_test_pnr]);

    await conn.query('SET @as_of_time = "2026-10-18 10:00:00"');
    await conn.query('CALL sp_cancel_passenger_ticket(?, NULL, "MIXED_TEST_CANCEL", 0, @out_chg, @out_ref, @out_stat)', [v_test_pnr]);

    const [refunds] = await conn.query(`
        SELECT 
            r.refund_id,
            r.cancel_id,
            c.passenger_no,
            pb.name as passenger_name,
            r.amount as refund_amount,
            r.reason,
            r.status as refund_status
        FROM REFUND r
        JOIN CANCELLATION c ON r.cancel_id = c.cancel_id
        JOIN PASSENGER_BOOKING pb ON c.pnr = pb.pnr AND c.passenger_no = pb.passenger_no
        WHERE c.pnr = ?
        ORDER BY c.passenger_no ASC
    `, [v_test_pnr]);

    console.log('REAL SELECT OF 3 REFUND ROWS IN TEST 13:');
    console.table(refunds);

    await conn.rollback();
    await conn.end();
})();
