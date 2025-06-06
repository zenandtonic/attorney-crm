const Airtable = require('airtable');
require('dotenv').config();

console.log('Airtable config loading...');
console.log('API Key present:', !!process.env.AIRTABLE_API_KEY);
console.log('Base ID present:', !!process.env.AIRTABLE_BASE_ID);

const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

module.exports = base;