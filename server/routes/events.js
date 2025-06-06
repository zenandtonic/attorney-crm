const express = require('express');
const base = require('../config/airtable');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Get all events
router.get('/', authenticateToken, async (req, res) => {
    try {
        const records = await base('Events').select().all();
        const events = records.map(record => ({
            id: record.id,
            name: record.fields['Event Name'] || '',  // Changed from 'Name' to 'Event Name'
            date: record.fields['Event Date'] || '',  // Changed from 'Date' to 'Event Date'
            description: record.fields.Description || ''
        }));

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

module.exports = router;