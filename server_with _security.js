const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// ==========================================
// THE NEW RBAC CONNECTION POOLS
// ==========================================
// 1. The Customer Pool (Restricted Access)
const customerPool = new Pool({
    host: 'localhost',
    user: 'app_customer',       // <--- NEW USER
    password: 'customer_pass',  // <--- NEW PASSWORD
    database: 'railway_db',
    port: 5432,
    max: 10
});

// 2. The Admin Pool (Full Access)

// ==========================================
// ROUTE 1: BOOK A TICKET (Uses Customer Pool)
// ==========================================
app.post('/api/book-ticket', async (req, res) => {
    const { userId, trainId } = req.body;
    const client = await customerPool.connect(); // <--- SECURED

    try {
        await client.query('BEGIN');

        // We still need to find and LOCK the seat to prevent Race Conditions
        const seatRes = await client.query(
            "SELECT seat_id FROM seats WHERE train_id = $1 AND is_booked = false LIMIT 1 FOR UPDATE", 
            [trainId]
        );

        if (seatRes.rows.length > 0) {
            const seatId = seatRes.rows[0].seat_id;
            
            // --- THE TRIGGER MAGIC ---
            // Notice there is NO "UPDATE seats" query here anymore!
            // We just insert the booking, and the PostgreSQL Trigger handles the rest.
            await client.query(
                'INSERT INTO bookings (user_id, train_id, seat_id) VALUES ($1, $2, $3)', 
                [userId, trainId, seatId]
            );

            await client.query('COMMIT');
            console.log(`[API] User ${userId} successfully booked seat ${seatId}`);
            res.status(200).json({ success: true, message: `Seat ${seatId} booked!` });
            
        } else {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, message: 'Sold out!' });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[API] Server Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

// ==========================================
// ROUTE 2: CANCEL A TICKET (Uses Customer Pool)
// ==========================================
app.delete('/api/cancel-ticket/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    
    try {
        await customerPool.query('DELETE FROM bookings WHERE id = $1', [bookingId]); // <--- SECURED
        
        console.log(`[API] Booking ${bookingId} cancelled.`);
        res.status(200).json({ success: true, message: `Booking cancelled. Seat is available again!` });
    } catch (error) {
        console.error('[API] Server Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// ==========================================
// ROUTE 3: SEARCH TRAINS (Uses Customer Pool)
// ==========================================
app.get('/api/search-trains', async (req, res) => {
    const { source, destination } = req.query;
    
    try {
        const result = await customerPool.query( // <--- SECURED
            'SELECT * FROM trains WHERE source = $1 AND destination = $2',
            [source, destination]
        );
        
        res.status(200).json({ success: true, trains: result.rows });
    } catch (error) {
        console.error('[API] Search Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚂 Railway API Server running on http://localhost:${PORT}`);
});