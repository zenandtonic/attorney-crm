const express = require('express');
const jwt = require('jsonwebtoken');
const base = require('../config/airtable');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Test route to make sure auth routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Auth routes are working!' });
});

// Verify token route
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        message: 'Authentication working',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);
    
    try {
        const records = await base('Attorneys').select({
            filterByFormula: `{Email} = '${email}'`
        }).firstPage();

        console.log('Found attorneys:', records.length);

        if (records.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const attorney = records[0];
        console.log('Attorney found:', attorney.fields.Name);
        
        // In production, you'd verify the password hash here
        // For now, we'll accept any password for testing
        
        const token = jwt.sign(
            { 
                id: attorney.id, 
                email: attorney.fields.Email,
                name: attorney.fields.Name 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login successful, token created');

        res.json({ 
            token, 
            user: { 
                id: attorney.id, 
                email: attorney.fields.Email,
                name: attorney.fields.Name 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed', details: error.message });
    }
});

module.exports = router;