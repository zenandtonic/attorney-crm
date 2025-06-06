# Attorney CRM

A modern Customer Relationship Management system designed specifically for attorneys to manage contacts, events, and RSVPs.

## Features

- **Contact Management**: Manage attorney contacts with company affiliations
- **Event Management**: Track events and manage attendee lists
- **RSVP Tracking**: Monitor RSVP status and actual attendance
- **Authentication**: Secure login system for attorneys
- **Responsive Design**: Works on desktop and mobile devices
- **Outlook Integration**: Drag and drop contacts from Outlook
- **Export Functionality**: Export contact lists to CSV
- **Pagination**: Efficient handling of large contact lists

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express.js
- **Database**: Airtable
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: Modern glassmorphism design with backdrop filters

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/attorney-crm.git
   cd attorney-crm
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:

   ```
   AIRTABLE_API_KEY=your_airtable_api_key
   AIRTABLE_BASE_ID=your_airtable_base_id
   JWT_SECRET=your_jwt_secret_key
   PORT=3000
   ```

4. Set up Airtable:

   - Create an Airtable base with the following tables:
     - **Attorneys**: Name, Email
     - **Contacts**: First Name, Last Name, Email, Company, Events, Associated Attorneys
     - **Companies**: Name
     - **Events**: Event Name, Event Date, Description
     - **RSVPs**: Linked Contact, Linked Event, RSVP Status, Attended

5. Start the server:

   ```bash
   npm start
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
attorney-crm/
├── public/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   └── contacts.js
│   └── index.html
├── server/
│   ├── config/
│   │   └── airtable.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── contacts.js
│   │   └── events.js
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Attorney login
- `GET /api/auth/verify` - Verify JWT token

### Contacts

- `GET /api/contacts` - Get all contacts (with pagination)
- `GET /api/contacts/event/:eventId` - Get contacts for specific event
- `POST /api/contacts/add-to-event` - Add contact to event

### Events

- `GET /api/events` - Get all events

## Usage

1. **Login**: Use your attorney credentials to log in
2. **View Contacts**: Browse all contacts or filter by event
3. **Manage Events**: Add contacts to events and track RSVPs
4. **Export Data**: Export contact lists to CSV format
5. **Outlook Integration**: Drag and drop contact cards from Outlook

## Development

To run in development mode with auto-restart:

```bash
npm install -g nodemon
nodemon server/server.js
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email [your-email@example.com] or create an issue in this repository.

## Roadmap

- [ ] Advanced search and filtering
- [ ] Email integration
- [ ] Calendar synchronization
- [ ] Mobile app
- [ ] Advanced reporting and analytics
- [ ] Bulk import/export functionality

## Acknowledgments

- Modern design inspired by glassmorphism trends
- Built with accessibility and user experience in mind
