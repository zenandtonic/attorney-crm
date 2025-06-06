const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Test routes FIRST
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working', 
        timestamp: new Date(),
        env: {
            hasAirtableKey: !!process.env.AIRTABLE_API_KEY,
            hasBaseId: !!process.env.AIRTABLE_BASE_ID,
            hasJwtSecret: !!process.env.JWT_SECRET
        }
    });
});

app.get('/api/test-airtable', async (req, res) => {
    try {
        console.log('Testing Airtable connection...');
        const base = require('./config/airtable');
        
        const records = await base('Attorneys').select().firstPage();
        
        res.json({
            success: true,
            message: 'Airtable connection working',
            recordCount: records.length,
            firstRecord: records[0] ? {
                id: records[0].id,
                fields: records[0].fields
            } : null
        });
    } catch (error) {
        console.error('Airtable test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add this right after your /api/test-airtable route
app.get('/api/debug-event/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const base = require('./config/airtable');
        
        // Get the event details
        const event = await base('Events').find(eventId);
        
        // Get all contacts and check their Events field
        const allContacts = await base('Contacts').select().all();
        
        const contactsWithEvents = allContacts.map(contact => ({
            name: `${contact.fields['First Name']} ${contact.fields['Last Name']}`,
            eventsField: contact.fields.Events || [],
            hasThisEvent: (contact.fields.Events || []).includes(eventId)
        }));
        
        res.json({
            eventId: eventId,
            eventDetails: event.fields,
            contactsWithEvents: contactsWithEvents
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this route after your /api/test-airtable route
app.get('/api/debug-all-tables', async (req, res) => {
    try {
        const base = require('./config/airtable');
        
        // Get data from all tables
        const events = await base('Events').select().all();
        
        res.json({
            success: true,
            tables: {
                events: {
                    count: events.length,
                    sample: events[0] ? {
                        id: events[0].id,
                        fields: events[0].fields,
                        fieldNames: Object.keys(events[0].fields)
                    } : null
                }
            }
        });
    } catch (error) {
        console.error('Debug all tables error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Import routes
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const eventsRoutes = require('./routes/events');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/events', eventsRoutes);

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Debug registered routes
console.log('Registering routes...');
app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
        console.log('Registered route:', r.route.path);
    }
});

// 404 handler - MUST BE LAST
app.use('*', (req, res) => {
    console.log('404 - Route not found:', req.originalUrl);
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Environment check:');
    console.log('- Airtable API Key:', process.env.AIRTABLE_API_KEY ? 'Set' : 'Missing');
    console.log('- Airtable Base ID:', process.env.AIRTABLE_BASE_ID ? 'Set' : 'Missing');
    console.log('- JWT Secret:', process.env.JWT_SECRET ? 'Set' : 'Missing');
});

// Add this debug route
app.get('/api/debug-event/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const base = require('./config/airtable');
        
        // Get the event details
        const event = await base('Events').find(eventId);
        
        // Get all contacts and check their Events field
        const allContacts = await base('Contacts').select().all();
        
        const contactsWithEvents = allContacts.map(contact => ({
            name: `${contact.fields['First Name']} ${contact.fields['Last Name']}`,
            eventsField: contact.fields.Events || [],
            hasThisEvent: (contact.fields.Events || []).includes(eventId)
        }));
        
        res.json({
            eventId: eventId,
            eventDetails: event.fields,
            contactsWithEvents: contactsWithEvents
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});