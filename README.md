EcoRide - Carpooling Platform

EcoRide is a modern, dynamic web application designed for ecological carpooling, aiming to reduce the environmental impact of car travel. The platform connects drivers and passengers, facilitating shared rides while promoting sustainable transportation.

🚀 Features

Core Functionality
- User Registration & Authentication: Secure user registration with password hashing, login/logout functionality
- Trip Management: Drivers can create trips with vehicle details, routes, dates, and pricing
- Reservation System: Passengers can book available seats on trips using a credit-based system
- Credit System: Users earn and spend credits for trip reservations and validations
- Review & Rating System: Passengers can rate drivers after completed trips
- Real-time Trip Status: Automatic status updates (planned → in progress → completed)

User Roles & Permissions
- Regular Users: Can create trips, make reservations, leave reviews, manage profile
- Employees: Can validate/reject user reviews and manage incidents
- Administrators: Full system access including user management, statistics, and platform oversight

Advanced Features
- Admin Dashboard: Comprehensive analytics including daily trip counts, revenue tracking, user statistics
- Incident Management: Employee panel for handling reported issues and negative reviews
- Vehicle Management: Users can register multiple vehicles with detailed specifications
- Trip History: Complete booking history with status tracking
- Automatic Status Updates: Background process automatically marks trips as completed
- Session Management: Secure session handling with user activity tracking

🛠 Technology Stack

Backend
- Node.js: JavaScript runtime environment
- Express.js: Web application framework for Node.js
- PostgreSQL: Primary relational database for structured data
- MongoDB: NoSQL database for flexible review/comment storage

Security & Authentication
- bcrypt: Password hashing for secure authentication
- express-session: Session management with secure cookies
- Input Validation: Comprehensive validation for all user inputs

Frontend
- EJS: Embedded JavaScript templating for dynamic HTML generation
- Bootstrap: CSS framework for responsive design
- Vanilla JavaScript: Client-side interactivity
- HTML5 & CSS3: Modern markup and styling

Database Libraries
- pg: PostgreSQL client for Node.js
- mongoose: MongoDB object modeling for Node.js

Development Tools
- dotenv: Environment variable management
- body-parser: Request body parsing middleware
- path: File and directory path utilities

📊 Database Schema

PostgreSQL Tables
- users: User accounts with roles (user/employee/admin)
- trajet: Trip information (routes, dates, pricing, status)
- vehicule: Vehicle details owned by drivers
- reservations: Trip bookings with credit tracking
- credits: User credit balances
- payouts: Payment tracking for drivers
- preferences_vehicule: Vehicle preference settings

MongoDB Collections
- avis: User reviews and ratings for trips

🔄 Application Flow

User Journey
1. Registration: New users create accounts with personal details
2. Vehicle Registration: Drivers add their vehicles to the platform
3. Trip Creation: Drivers create trips specifying routes, dates, and pricing
4. Trip Discovery: Users browse available trips on the platform
5. Reservation: Passengers book seats using their credits
6. Trip Execution: Drivers update trip status (start/complete)
7. Validation: Passengers validate completed trips and can leave reviews
8. Review Moderation: Employees review and approve user feedback

Credit System Flow
- Users start with 20 initial credits
- Trip reservations deduct credits from passengers
- Successful trip completion credits drivers (10% of trip cost)
- Credits can be refunded for cancellations

Review System Flow
- Reviews are stored in MongoDB for flexibility
- Employee validation required before reviews are published
- Negative reviews (≤3 stars) require mandatory comments
- Approved reviews trigger driver crediting

🚀 Installation & Setup

Prerequisites
- Node.js v22.11.0 or higher
- PostgreSQL 15.4 or higher
- MongoDB instance
- Git v2.46.1 or higher


Installation Steps
1. Clone the repository
   git clone <repository-url>
   cd ecoride-projet

2. Install dependencies
   npm install

3. Set up PostgreSQL database
   - Create a new PostgreSQL database
   - Run the SQL scripts in queries.sql to create tables

4. Set up MongoDB
   - Ensure MongoDB is running locally or configure remote connection

5. Start the application
   npm start

6. Access the application
   - Open browser to http://localhost:3000

📁 Project Structure

```
ecoride-projet/
├── app.js                 # Main application file
├── models/
│   └── avis.js           # MongoDB review model
├── routes/
│   ├── reservation.js    # Reservation routes
│   └── contact.js        # Contact form routes
├── views/                # EJS templates
│   ├── index.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── profile.ejs
│   ├── trajets.ejs
│   ├── admin-dashboard.ejs
│   └── ...
├── public/               # Static assets (CSS, JS, images)
├── queries.sql           # Database schema and initial data
├── package.json
├── .env                  # Environment variables (create this)
└── README.md
```

🔧 Key API Endpoints

Authentication
- POST /register - User registration
- POST /login - User login
- GET /logout - User logout

Trips
- GET /trajets - List all available trips
- POST /trajet/creer - Create new trip
- GET /trajet/:id - View trip details
- POST /reserver-trajet - Book a trip

User Management
- GET /profile - User profile page
- POST /details - Add vehicle details

Admin/Employee
- GET /admin - Admin dashboard
- GET /employe/avis - Employee review management
- POST /employe/avis/valider - Validate/reject reviews

Reviews & Validation
- POST /avis - Submit trip review
- GET /validations - View pending validations
- POST /reservation/:id/valider - Validate completed trip

🔒 Security Features

- Password hashing with bcrypt
- Session-based authentication
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- XSS protection through EJS templating
- Role-based access control (user/employee/admin)
- Account suspension functionality

📈 Performance Optimizations

- Database connection pooling
- Efficient SQL queries with proper indexing
- Background job for automatic trip status updates
- Session optimization with proper cleanup
- Static file caching

🚀 Deployment

The application is configured for deployment on Fly.io with:
- Environment variable configuration
- Database connection handling
- Static file serving optimization
- Error handling and logging

🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

👥 Authors

- Developed as part of a web development project

🙏 Acknowledgments

- Built with modern web technologies
- Focus on ecological transportation solutions
- Comprehensive user experience design
