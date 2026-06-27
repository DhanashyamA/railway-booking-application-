// Note: To run this, you need the PostgreSQL package: npm install pg
const { Client } = require('pg');

// This function simulates an attempt to book a ticket using your full schema
async function bookTicket(userId, trainId) {
    // 1. Connect to your PostgreSQL database
    const client = new Client({
        host: 'localhost',
        user: 'postgres',
        password: 'postgres', // Don't forget to update this to your actual pg password!
        database: 'railway_db',
        port: 5432
    });

    await client.connect();

    try {
        console.log(`[User ${userId}] Attempting to book a seat on Train ${trainId}...`);

        // 2. START THE POSTGRESQL TRANSACTION
        await client.query('BEGIN');

        // 3. THE MAGIC QUERY: Find ONE available seat and LOCK IT
        // Matches your exact schema: seat_id and is_booked = false
        const seatRes = await client.query(
            "SELECT seat_id FROM seats WHERE train_id = $1 AND is_booked = false LIMIT 1 FOR UPDATE", 
            [trainId]
        );

        // 4. Check if we actually found an available seat
        if (seatRes.rows.length > 0) {
            const seatId = seatRes.rows[0].seat_id;
            console.log(`[User ${userId}] Found available seat: ${seatId}. Locking it.`);

            // Simulate network delay (1 second) to prove the database is freezing the other user!
            await new Promise(resolve => setTimeout(resolve, 1000)); 

            // 5. Mark the seat as 'booked' in the seats table
            await client.query(
                "UPDATE seats SET is_booked = true WHERE seat_id = $1", 
                [seatId]
            );

            // 6. Create the official record in the bookings table
            await client.query(
                'INSERT INTO bookings (user_id, train_id, seat_id) VALUES ($1, $2, $3)', 
                [userId, trainId, seatId]
            );

            // 7. COMMIT: Save everything and release the lock on that seat
            await client.query('COMMIT');
            console.log(`[User ${userId}] SUCCESS! Seat ${seatId} booked successfully.`);
        } else {
            // If the query found no seats, cancel the transaction
            await client.query('ROLLBACK');
            console.log(`[User ${userId}] FAILED: No seats left on this train!`);
        }

    } catch (error) {
        // Global Undo if the database crashes
        await client.query('ROLLBACK');
        console.error(`[User ${userId}] ERROR: Transaction rolled back.`, error.message);
    } finally {
        await client.end();
    }
}

// --- THE RACE CONDITION SIMULATION ---
async function simulateTrafficSpike() {
    console.log("--- SIMULATING 2 USERS BOOKING THE LAST SEAT AT THE EXACT SAME MILLISECOND ---");
    
    // Using your actual User IDs (2 for bunny, 3 for dhana) and your Train ID (12773)
    await Promise.all([
        bookTicket(2, 12773),
        bookTicket(3, 12773)
    ]);
}

simulateTrafficSpike();