const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json()); // Allows our server to parse incoming JSON data

// 1. Configure the connection to your PostgreSQL database
const pool = new Pool({
    user: 'postgres',          // Default PostgreSQL username
    host: 'localhost',
    database: 'railway_db',    // The database name you created in pgAdmin
    password: 'postgres', // Replace this with your actual master password!
    port: 5432,                // Default PostgreSQL port
});

// 2. The High-Concurrency Booking Endpoint
app.post('/book', async (req, res) => {
    const { userId, trainId } = req.body;

    // Get a dedicated client from the connection pool to run a Transaction
    const client = await pool.connect();

    try {
        // Start the SQL Transaction
        await client.query('BEGIN');

        // Step A: Find ONE available seat on this train and apply a Row-Level Lock (FOR UPDATE)
        const findSeatQuery = `
            SELECT seat_id, seat_number 
            FROM Seats 
            WHERE train_id = $1 AND is_booked = FALSE 
            LIMIT 1 
            FOR UPDATE;
        `;
        const seatResult = await client.query(findSeatQuery, [trainId]);

        // If no seats are left, roll back and exit
        if (seatResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Train is fully booked!" });
        }

        const bookedSeat = seatResult.rows[0];

        // Step B: Update the seat status to booked
        const updateSeatQuery = `
            UPDATE Seats 
            SET is_booked = TRUE 
            WHERE seat_id = $1;
        `;
        await client.query(updateSeatQuery, [bookedSeat.seat_id]);

        // Step C: Insert the booking ledger record
        const insertBookingQuery = `
            INSERT INTO Bookings (user_id, seat_id) 
            VALUES ($1, $2) 
            RETURNING booking_id;
        `;
        const bookingResult = await client.query(insertBookingQuery, [userId, bookedSeat.seat_id]);

        // Commit the transaction! This saves changes and automatically releases the row lock
        await client.query('COMMIT');

        res.json({
            message: "Booking Successful!",
            bookingId: bookingResult.rows[0].booking_id,
            seatNumber: bookedSeat.seat_number
        });

    } catch (error) {
        // If anything fails (network drop, crash), undo everything so data stays pristine
        await client.query('ROLLBACK');
        console.error("Transaction Error:", error);
        res.status(500).json({ error: "Transaction aborted due to server error." });
    } finally {
        // Crucial: Release the client back to the pool so other users can use it
        client.release();
    }
});

// Start the server on port 3000
app.listen(3000, () => {
    console.log("Railway Booking Engine running on http://localhost:3000");
});