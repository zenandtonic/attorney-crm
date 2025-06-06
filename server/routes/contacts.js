const express = require('express');
const base = require('../config/airtable');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Helper function to sort contacts with RSVP prioritization
function sortContactsWithRSVP(contacts, sortBy, sortDirection, prioritizeRSVPs) {
    if (prioritizeRSVPs) {
        // First sort by RSVP priority: Yes -> No -> Pending/null
        contacts.sort((a, b) => {
            const aRSVP = a.rsvpStatus || 'Pending';
            const bRSVP = b.rsvpStatus || 'Pending';
            
            // Define priority order
            const rsvpPriority = { 'Yes': 3, 'No': 2, 'Pending': 1 };
            const aPriority = rsvpPriority[aRSVP] || 1;
            const bPriority = rsvpPriority[bRSVP] || 1;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            // If RSVP status is the same, fall back to secondary sort
            if (sortBy) {
                let aValue = a[sortBy];
                let bValue = b[sortBy];
                
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue ? bValue.toLowerCase() : '';
                }
                
                if (aValue === undefined || aValue === null) aValue = '';
                if (bValue === undefined || bValue === null) bValue = '';
                
                let comparison = 0;
                if (aValue < bValue) {
                    comparison = -1;
                } else if (aValue > bValue) {
                    comparison = 1;
                }
                
                return sortDirection === 'desc' ? comparison * -1 : comparison;
            }
            
            return 0;
        });
    } else if (sortBy) {
        // Regular sorting without RSVP prioritization
        contacts = sortContacts(contacts, sortBy, sortDirection);
    }
    
    return contacts;
}

// Helper function to sort contacts
function sortContacts(contacts, sortBy, sortDirection) {
    if (!sortBy) return contacts;
    
    return contacts.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        // Handle different data types
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue ? bValue.toLowerCase() : '';
        }
        
        // Handle undefined/null values
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';
        
        let comparison = 0;
        
        if (aValue < bValue) {
            comparison = -1;
        } else if (aValue > bValue) {
            comparison = 1;
        }
        
        return sortDirection === 'desc' ? comparison * -1 : comparison;
    });
}

// Cache for companies and events to reduce API calls
const dataCache = {
    companies: new Map(),
    events: new Map(),
    lastCacheTime: 0,
    cacheTimeout: 5 * 60 * 1000 // 5 minutes
};

// Helper function to get company with caching
async function getCompanyWithCache(companyId) {
    const now = Date.now();
    
    // Clear cache if expired
    if (now - dataCache.lastCacheTime > dataCache.cacheTimeout) {
        dataCache.companies.clear();
        dataCache.events.clear();
        dataCache.lastCacheTime = now;
    }
    
    if (dataCache.companies.has(companyId)) {
        return dataCache.companies.get(companyId);
    }
    
    try {
        const company = await base('Companies').find(companyId);
        const companyData = { id: company.id, name: company.fields.Name || '' };
        dataCache.companies.set(companyId, companyData);
        return companyData;
    } catch (error) {
        console.log('Error fetching company:', error.message);
        return { id: companyId, name: '' };
    }
}

// Helper function to get event with caching
async function getEventWithCache(eventId) {
    const now = Date.now();
    
    if (dataCache.events.has(eventId)) {
        return dataCache.events.get(eventId);
    }
    
    try {
        const event = await base('Events').find(eventId);
        const eventData = { 
            id: event.id, 
            name: event.fields['Event Name'] || event.fields.Name || 'Unnamed Event' 
        };
        dataCache.events.set(eventId, eventData);
        return eventData;
    } catch (error) {
        console.log('Error fetching event:', error.message);
        return { id: eventId, name: 'Unnamed Event' };
    }
}

// Optimized batch processing function
async function processContactsBatch(contacts, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const batchPromises = batch.map(async (record) => {
            // Get company information with caching
            let companyName = '';
            const companyField = record.fields['Company'];
            if (companyField && companyField.length > 0) {
                const company = await getCompanyWithCache(companyField[0]);
                companyName = company.name;
            }

            // Get associated events with caching and reduced logging
            let events = [];
            const eventsField = record.fields['Events'];
            if (eventsField && Array.isArray(eventsField) && eventsField.length > 0) {
                const eventPromises = eventsField.map(eventId => getEventWithCache(eventId));
                events = await Promise.all(eventPromises);
            }

            return {
                id: record.id,
                firstName: record.fields['First Name'] || '',
                lastName: record.fields['Last Name'] || '',
                email: record.fields['Email'] || '',
                companyName: companyName,
                events: events,
                rsvpStatus: 'Pending'
            };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    
    return results;
}

// Debug route to inspect contact fields
router.get('/debug-fields', authenticateToken, async (req, res) => {
    try {
        const records = await base('Contacts').select().firstPage();
        
        if (records.length > 0) {
            const sampleContact = records[0];
            const fieldNames = Object.keys(sampleContact.fields);
            
            res.json({
                sampleContactId: sampleContact.id,
                availableFields: fieldNames,
                sampleData: sampleContact.fields
            });
        } else {
            res.json({ message: 'No contacts found' });
        }
    } catch (error) {
        console.error('Error debugging fields:', error);
        res.status(500).json({ error: 'Failed to debug fields' });
    }
});

// Debug route to test event fetching
router.get('/debug-events', authenticateToken, async (req, res) => {
    try {
        const contacts = await base('Contacts').select().firstPage();
        const results = [];
        
        for (const contact of contacts) {
            const eventsField = contact.fields['Events'];
            let eventNames = [];
            
            if (eventsField && Array.isArray(eventsField) && eventsField.length > 0) {
                try {
                    const eventPromises = eventsField.map(eventId => base('Events').find(eventId));
                    const eventRecords = await Promise.all(eventPromises);
                    eventNames = eventRecords.map(event => event.fields['Event Name'] || 'No Name');
                } catch (error) {
                    eventNames = [`Error: ${error.message}`];
                }
            }
            
            results.push({
                contactName: `${contact.fields['First Name']} ${contact.fields['Last Name']}`,
                eventsField: eventsField,
                eventNames: eventNames
            });
        }
        
        res.json({ results });
    } catch (error) {
        console.error('Error debugging events:', error);
        res.status(500).json({ error: 'Failed to debug events' });
    }
});

// Get all contacts for the authenticated attorney (with pagination and sorting)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const showAllAttorneys = req.query.allAttorneys === 'true';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const sortBy = req.query.sortBy;
        const sortDirection = req.query.sortDirection || 'asc';
        const prioritizeRSVPs = req.query.prioritizeRSVPs === 'true';
        
        console.log('Fetching contacts - Page:', page, 'Limit:', limit, 'Show all attorneys:', showAllAttorneys);
        console.log('Sorting by:', sortBy, sortDirection, 'Prioritize RSVPs:', prioritizeRSVPs);
        
        // Get all contacts
        const contactRecords = await base('Contacts').select().all();
        console.log('Sample contact fields:', contactRecords.length > 0 ? Object.keys(contactRecords[0].fields) : 'No contacts found');
        
        let filtered;
        if (showAllAttorneys) {
            filtered = contactRecords;
        } else {
            filtered = contactRecords.filter(record => {
                const attorneys = record.fields['Associated Attorneys'] || [];
                return attorneys.includes(req.user.id);
            });
        }

        // Process contacts to include company and event information
        const processedContacts = await Promise.all(filtered.map(async (record) => {
            // Get company information
            let companyName = '';
            const companyField = record.fields['Company'];
            if (companyField && companyField.length > 0) {
                try {
                    const companyRecord = await base('Companies').find(companyField[0]);
                    companyName = companyRecord.fields.Name || '';
                } catch (error) {
                    console.log('Error fetching company:', error.message);
                }
            }

            // Get associated events - only from Contacts table
            let events = [];
            const eventsField = record.fields['Events'] || record.fields['Associated Events'] || record.fields['Event'];
            
            // Enhanced logging
            console.log(`\n=== CONTACT: ${record.fields['First Name']} ${record.fields['Last Name']} ===`);
            console.log('Events field value:', eventsField);
            console.log('Events field type:', typeof eventsField);
            console.log('Is array:', Array.isArray(eventsField));
            console.log('Field length:', eventsField?.length);
            
            if (eventsField && Array.isArray(eventsField) && eventsField.length > 0) {
                console.log('Event IDs to fetch:', eventsField);
                try {
                    const eventPromises = eventsField.map((eventId, index) => {
                        console.log(`Fetching event ${index + 1}/${eventsField.length}: ${eventId}`);
                        return base('Events').find(eventId).catch(err => {
                            console.log(`Error fetching event ${eventId}:`, err.message);
                            return null;
                        });
                    });
                    const eventRecords = await Promise.all(eventPromises);
                    
                    console.log('Raw event records:', eventRecords);
                    
                    events = eventRecords
                        .filter(event => event !== null)
                        .map(event => {
                            console.log('Processing event:', event.id, 'Fields:', Object.keys(event.fields));
                            console.log('Event Name field:', event.fields['Event Name']);
                            console.log('Name field:', event.fields.Name);
                            return {
                                id: event.id,
                                name: event.fields['Event Name'] || event.fields.Name || 'Unnamed Event'
                            };
                        });
                    console.log(`Final processed events:`, events);
                } catch (error) {
                    console.log('Error fetching events:', error.message);
                }
            } else if (eventsField) {
                console.log(`Events field exists but is not a valid array`);
            } else {
                console.log(`No events field found`);
            }
            console.log('=== END CONTACT DEBUG ===\n');

            // For general contacts list, set default RSVP status
            let rsvpStatus = 'Pending';

            return {
                id: record.id,
                firstName: record.fields['First Name'] || '',
                lastName: record.fields['Last Name'] || '',
                email: record.fields['Email'] || '',
                companyName: companyName,
                events: events,
                rsvpStatus: rsvpStatus
            };
        }));

        // Sort the processed contacts (with RSVP prioritization if requested)
        const sortedContacts = sortContactsWithRSVP(processedContacts, sortBy, sortDirection, prioritizeRSVPs);
        
        // Apply pagination after sorting
        const totalContacts = sortedContacts.length;
        const totalPages = Math.ceil(totalContacts / limit);
        const offset = (page - 1) * limit;
        const paginatedContacts = sortedContacts.slice(offset, offset + limit);

        console.log(`Total: ${totalContacts}, Page ${page}/${totalPages}, Showing: ${paginatedContacts.length}`);

        res.json({
            contacts: paginatedContacts,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalContacts: totalContacts,
                limit: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                sortBy: sortBy,
                sortDirection: sortDirection,
                prioritizeRSVPs: prioritizeRSVPs
            }
        });
        
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts', details: error.message });
    }
});

// Get contacts for a specific event (with pagination and sorting)
router.get('/event/:eventId', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    const showAllAttorneys = req.query.allAttorneys === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const sortBy = req.query.sortBy;
    const sortDirection = req.query.sortDirection || 'asc';
    const prioritizeRSVPs = req.query.prioritizeRSVPs === 'true';
    
    try {
        console.log('Fetching event contacts - Page:', page, 'Limit:', limit);
        
        // Get contacts and RSVPs in parallel for better performance
        const [allContacts, rsvps] = await Promise.all([
            base('Contacts').select().all(),
            base('RSVPs').select().all()
        ]);
        
        const eventRSVPs = rsvps.filter(rsvp => {
            const rsvpEvents = rsvp.fields['Linked Event'] || [];
            return rsvpEvents.includes(eventId);
        });
        
        let contactsWithThisEvent;
        if (showAllAttorneys) {
            contactsWithThisEvent = allContacts.filter(contact => {
                const events = contact.fields.Events || [];
                return events.includes(eventId);
            });
        } else {
            contactsWithThisEvent = allContacts.filter(contact => {
                const events = contact.fields.Events || [];
                const hasEvent = events.includes(eventId);
                
                const attorneys = contact.fields['Associated Attorneys'] || [];
                const belongsToUser = attorneys.includes(req.user.id);
                
                return hasEvent && belongsToUser;
            });
        }

        // Process contacts with optimized batch processing
        const processedContacts = await Promise.all(contactsWithThisEvent.map(async (contact) => {
            // Find the RSVP record for this contact and event
            const contactRSVP = eventRSVPs.find(rsvp => {
                const rsvpContacts = rsvp.fields['Linked Contact'] || [];
                return rsvpContacts.includes(contact.id);
            });
            
            const rsvpStatus = contactRSVP ? (contactRSVP.fields['RSVP Status'] || 'Pending') : 'Pending';
            const attended = contactRSVP ? (contactRSVP.fields.Attended || false) : false;
            
            // Get company information with caching
            let companyName = '';
            const companyField = contact.fields['Company'];
            if (companyField && companyField.length > 0) {
                const company = await getCompanyWithCache(companyField[0]);
                companyName = company.name;
            }

            // Get associated events with caching
            let events = [];
            const eventsField = contact.fields['Events'];
            if (eventsField && Array.isArray(eventsField) && eventsField.length > 0) {
                const eventPromises = eventsField.map(eventId => getEventWithCache(eventId));
                events = await Promise.all(eventPromises);
            }
            
            return {
                id: contact.id,
                firstName: contact.fields['First Name'] || '',
                lastName: contact.fields['Last Name'] || '',
                email: contact.fields['Email'] || '',
                companyName: companyName,
                events: events,
                rsvpStatus: rsvpStatus,
                attended: attended
            };
        }));

        // Sort the processed contacts (with RSVP prioritization if requested)
        const sortedContacts = sortContactsWithRSVP(processedContacts, sortBy, sortDirection, prioritizeRSVPs);
        
        // Apply pagination after sorting
        const totalContacts = sortedContacts.length;
        const totalPages = Math.ceil(totalContacts / limit);
        const offset = (page - 1) * limit;
        const paginatedContacts = sortedContacts.slice(offset, offset + limit);

        console.log(`Event total: ${totalContacts}, Page ${page}/${totalPages}, Showing: ${paginatedContacts.length}`);

        res.json({
            contacts: paginatedContacts,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalContacts: totalContacts,
                limit: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                sortBy: sortBy,
                sortDirection: sortDirection,
                prioritizeRSVPs: prioritizeRSVPs
            }
        });
        
    } catch (error) {
        console.error('Error fetching event contacts:', error);
        res.status(500).json({ error: 'Failed to fetch event contacts' });
    }
});

// Get all events
router.get('/events-for-adding', authenticateToken, async (req, res) => {
    try {
        const records = await base('Events').select().all();
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set to start of today for comparison
        
        const events = records
            .map(record => ({
                id: record.id,
                name: record.fields['Event Name'] || record.fields.Name || '',
                date: record.fields['Event Date'] || record.fields.Date || null,
                description: record.fields.Description || ''
            }))
            .filter(event => {
                // Only include events with future dates or no date
                if (!event.date) return true; // Include events without dates
                
                const eventDate = new Date(event.date);
                return eventDate >= currentDate; // Include today and future dates
            })
            .sort((a, b) => {
                // Sort by date, with events without dates at the end
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });

        console.log(`Returning ${events.length} future events for adding contacts`);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events for adding:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});
router.post('/create', authenticateToken, async (req, res) => {
    const { firstName, lastName, companyName, email, selectedEvents } = req.body;
    
    console.log('Creating new contact:', { firstName, lastName, companyName, email, selectedEvents });
    
    try {
        // First, create or find the company if provided
        let companyId = null;
        if (companyName && companyName.trim()) {
            try {
                // Check if company already exists
                const existingCompanies = await base('Companies').select({
                    filterByFormula: `{Name} = '${companyName.trim()}'`
                }).firstPage();
                
                if (existingCompanies.length > 0) {
                    companyId = existingCompanies[0].id;
                    console.log('Found existing company:', companyId);
                } else {
                    // Create new company
                    const newCompany = await base('Companies').create({
                        'Name': companyName.trim()
                    });
                    companyId = newCompany.id;
                    console.log('Created new company:', companyId);
                }
            } catch (error) {
                console.log('Error handling company:', error.message);
                // Continue without company if there's an error
            }
        }
        
        // Create the contact record
        const contactFields = {
            'First Name': firstName,
            'Last Name': lastName,
            'Email': email,
            'Associated Attorneys': [req.user.id], // Associate with current user
            'Full Name': `${firstName} ${lastName}` // Calculated field
        };
        
        // Add company if we have one
        if (companyId) {
            contactFields['Company'] = [companyId];
        }
        
        // Add events if selected
        if (selectedEvents && selectedEvents.length > 0) {
            contactFields['Events'] = selectedEvents;
        }
        
        const newContact = await base('Contacts').create(contactFields);
        console.log('Created new contact:', newContact.id);
        
        res.json({ 
            success: true, 
            contactId: newContact.id,
            message: 'Contact created successfully'
        });
        
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ 
            error: 'Failed to create contact', 
            details: error.message 
        });
    }
});

// Add contact to event
router.post('/add-to-event', authenticateToken, async (req, res) => {
    const { contactId, eventId } = req.body;
    console.log('Adding contact to event:', { contactId, eventId });
    
    try {
        // Create RSVP record
        const rsvpRecord = await base('RSVPs').create({
            'Linked Contact': [contactId],
            'Linked Event': [eventId],
            'RSVP Status': 'Pending'
        });

        console.log('Created RSVP:', rsvpRecord.id);
        res.json({ success: true, rsvpId: rsvpRecord.id });
        
    } catch (error) {
        console.error('Error adding contact to event:', error);
        res.status(500).json({ error: 'Failed to add contact to event', details: error.message });
    }
});

module.exports = router;