const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres', // Remember to change this!
    database: 'railway_db',
    port: 5432,
    max: 10
});

app.get('/api/search-trains', async (req, res) => {
    // We grab 'source' and 'destination' from the URL query parameters
    // Example: /api/search-trains?source=Hyderabad&destination=Bangalore
    const { source, destination } = req.query;
    
    try {
        // Thanks to our PostgreSQL Index, this query is lightning fast (O(log N))
        // even if there are 10 million trains in the database!
        const result = await pool.query(
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