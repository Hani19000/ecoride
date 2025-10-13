EcoRide - Carpooling Platform

EcoRide is a modern, dynamic web application designed for ecological carpooling, aiming to reduce the environmental impact of car travel. The platform connects drivers and passengers, facilitating shared rides while promoting sustainable transportation.

<span style="color: red; font-size: 24px;">🚀 Features</span>

<span style="color: blue; font-size: 20px;">Core Functionality</span>
- User Registration & Authentication: Secure user registration with password hashing, login/logout functionality
- Trip Management: Drivers can create trips with vehicle details, routes, dates, and pricing
- Reservation System: Passengers can book available seats on trips using a credit-based system
- Credit System: Users earn and spend credits for trip reservations and validations
- Review & Rating System: Passengers can rate drivers after completed trips
- Real-time Trip Status: Automatic status updates (planned → in progress → completed)

<span style="color: blue; font-size: 20px;">User Roles & Permissions</span>
- Regular Users: Can create trips, make reservations, leave reviews, manage profile
- Employees: Can validate/reject user reviews and manage incidents
- Administrators: Full system access including user management, statistics, and platform oversight

<span style="color: blue; font-size: 20px;">Advanced Features</span>
- Admin Dashboard: Comprehensive analytics including daily trip counts, revenue tracking, user statistics
- Incident Management: Employee panel for handling reported issues and negative reviews
- Vehicle Management: Users can register multiple vehicles with detailed specifications
- Trip History: Complete booking history with status tracking
- Automatic Status Updates: Background process automatically marks trips as completed
- Session Management: Secure session handling with user activity tracking

<span style="color: red; font-size: 24px;">🛠 Technology Stack</span>

<span style="color: blue; font-size: 20px;">Backend</span>
- Node.js: JavaScript runtime environment
- Express.js: Web application framework for Node.js
- PostgreSQL: Primary relational database for structured data
- MongoDB: NoSQL database for flexible review/comment storage

<span style="color: blue; font-size: 20px;">Security & Authentication</span>
- bcrypt: Password hashing for secure authentication
- express-session: Session management with secure cookies
- Input Validation: Comprehensive validation for all user inputs

<span style="color: blue; font-size: 20px;">Frontend</span>
- EJS: Embedded JavaScript templating for dynamic HTML generation
- Bootstrap: CSS framework for responsive design
- Vanilla JavaScript: Client-side interactivity
- HTML5 & CSS3: Modern markup and styling

<span style="color: blue; font-size: 20px;">Database Libraries</span>
- pg: PostgreSQL client for Node.js
- mongoose: MongoDB object modeling for Node.js

<span style="color: blue; font-size: 20px;">Development Tools</span>
- dotenv: Environment variable management
- body-parser: Request body parsing middleware
- path: File and directory path utilities

<span style="color: red; font-size: 24px;">📊 Database Schema</span>

<span style="color: blue; font-size: 20px;">PostgreSQL Tables</span>
- users: User accounts with roles (user/employee/admin)
- trajet: Trip information (routes, dates, pricing, status)
- vehicule: Vehicle details owned by drivers
- reservations: Trip bookings with credit tracking
- credits: User credit balances
- payouts: Payment tracking for drivers
- preferences_vehicule: Vehicle preference settings

<span style="color: blue; font-size: 20px;">MongoDB Collections</span>
- avis: User reviews and ratings for trips

<span style="color: red; font-size: 24px;">🔄 Application Flow</span>

<span style="color: blue; font-size: 20px;">User Journey</span>
1. Registration: New users create accounts with personal details
2. Vehicle Registration: Drivers add their vehicles to the platform
3. Trip Creation: Drivers create trips specifying routes, dates, and pricing
4. Trip Discovery: Users browse available trips on the platform
5. Reservation: Passengers book seats using their credits
6. Trip Execution: Drivers update trip status (start/complete)
7. Validation: Passengers validate completed trips and can leave reviews
8. Review Moderation: Employees review and approve user feedback

<span style="color: blue; font-size: 20px;">Credit System Flow</span>
- Users start with 20 initial credits
- Trip reservations deduct credits from passengers
- Successful trip completion credits drivers (10% of trip cost)
- Credits can be refunded for cancellations

<span style="color: blue; font-size: 20px;">Review System Flow</span>
- Reviews are stored in MongoDB for flexibility
- Employee validation required before reviews are published
- Negative reviews (≤3 stars) require mandatory comments
- Approved reviews trigger driver crediting

<span style="color: red; font-size: 24px;">🚀 Installation & Setup</span>

<span style="color: blue; font-size: 20px;">Prerequisites</span>
- Node.js v22.11.0 or higher
- PostgreSQL 15.4 or higher
- MongoDB instance
- Git v2.46.1 or higher

<span style="color: blue; font-size: 20px;">Environment Configuration</span>
Create a .env file in the root directory:

```
# Database Configuration
PGUSER=your_postgres_username
PGHOST=your_postgres_host
PGDATABASE=your_database_name
PGPASSWORD=your_postgres_password
PGPORT=5432
PGSSLMODE=require

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ecoride
MONGO_URI=mongodb://localhost:27017/ecoride

# Session Configuration
SESSION_SECRET=your_ultra_secure_session_secret
```

<span style="color: blue; font-size: 20px;">Installation Steps</span>
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

<span style="color: red; font-size: 24px;">📁 Project Structure</span>

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

<span style="color: red; font-size: 24px;">🔧 Key API Endpoints</span>

<span style="color: blue; font-size: 20px;">Authentication</span>
- POST /register - User registration
- POST /login - User login
- GET /logout - User logout

<span style="color: blue; font-size: 20px;">Trips</span>
- GET /trajets - List all available trips
- POST /trajet/creer - Create new trip
- GET /trajet/:id - View trip details
- POST /reserver-trajet - Book a trip

<span style="color: blue; font-size: 20px;">User Management</span>
- GET /profile - User profile page
- POST /details - Add vehicle details

<span style="color: blue; font-size: 20px;">Admin/Employee</span>
- GET /admin - Admin dashboard
- GET /employe/avis - Employee review management
- POST /employe/avis/valider - Validate/reject reviews

<span style="color: blue; font-size: 20px;">Reviews & Validation</span>
- POST /avis - Submit trip review
- GET /validations - View pending validations
- POST /reservation/:id/valider - Validate completed trip

<span style="color: red; font-size: 24px;">🔒 Security Features</span>

- Password hashing with bcrypt
- Session-based authentication
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- XSS protection through EJS templating
- Role-based access control (user/employee/admin)
- Account suspension functionality

<span style="color: red; font-size: 24px;">📈 Performance Optimizations</span>

- Database connection pooling
- Efficient SQL queries with proper indexing
- Background job for automatic trip status updates
- Session optimization with proper cleanup
- Static file caching

<span style="color: red; font-size: 24px;">🚀 Deployment</span>

The application is configured for deployment on Fly.io with:
- Environment variable configuration
- Database connection handling
- Static file serving optimization
- Error handling and logging

<span style="color: red; font-size: 24px;">🤝 Contributing</span>

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

<span style="color: red; font-size: 24px;">📝 License</span>

This project is licensed under the MIT License - see the LICENSE file for details.

<span style="color: red; font-size: 24px;">👥 Authors</span>

- Developed as part of a web development project

<span style="color: red; font-size: 24px;">🙏 Acknowledgments</span>

- Built with modern web technologies
- Focus on ecological transportation solutions
- Comprehensive user experience design
