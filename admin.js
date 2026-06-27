const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const adminPool = new Pool({
    host: 'localhost',
    user: 'app_admin',          // <--- NEW USER
    password: 'admin_pass',     // <--- NEW PASSWORD
    database: 'railway_db',
    port: 5432,
    max: 5
});
app.post('/api/trains', async (req, res) => {
    const { trainId, source, destination, totalSeats } = req.body;
    
    // Only the Admin Pool has the hardware-level permission to INSERT into the trains table!
    const client = await adminPool.connect(); // <--- SECURED
    
    try {
        await client.query('BEGIN');
        
        // 1. Insert the train into the trains table
        await client.query(
            'INSERT INTO trains (id, source, destination) VALUES ($1, $2, $3)',
            [trainId, source, destination]
        );
        
        // 2. Automatically generate the requested number of seats for this train!
        for (let i = 1; i <= totalSeats; i++) {
            const seatNumber = `${i}A`; // e.g., 1A, 2A, 3A
            await client.query(
                'INSERT INTO seats (train_id, seat_number, is_booked) VALUES ($1, $2, false)',
                [trainId, seatNumber]
            );
        }
        
        await client.query('COMMIT');
        console.log(`[API] Added Train ${trainId}: ${source} -> ${destination} with ${totalSeats} seats.`);
        res.status(201).json({ success: true, message: `Train ${trainId} added successfully!` });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[API] Error adding train:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚂 Railway API Server running on http://localhost:${PORT}`);
});