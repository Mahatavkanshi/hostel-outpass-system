const express = require('express');         
const cors = require('cors');                  // middleware .. it allows your frontend to talk to your backend without security problems.
const dotenv = require('dotenv');            // dotenv is used to load envoirnment variables from a dotenv  file(.env) into process.env in node.js.
const authRoutes = require('./routes/auth.routes');    // handle all the authentification related routes like login,signup etc.
const profileRoutes = require('./routes/profile.routes');     // handle all the profile related routes like view profile, updae profile etc.
const verificationRoutes = require('./routes/verification.routes'); // handles all the verification related routes like request verification, approve verification etc.
const outpassRoutes = require('./routes/outpass.routes');     // handles all the outpass related routes like request outpass, approve outpass etc.
const contactRoutes = require('./routes/contact.routes');    // handles all the contact related routes like contact form submission, send email etc.
const sendLateMailsRoutes = require('./routes/sendLateMails.routes');
dotenv.config(); // Load .env vars       //loads sensitive configuration from .env file into process.env
const locationRoutes = require('./routes/location.routes');
const path = require('path');


const connectDB = require('./config/db');  // establishes connection to the database using mongoose.
const app = express();                     // creates the  core express application instance, all middleware and routes will be attached to this.

// Connect to DB
connectDB();

// Middlewares
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  
  'https://hostel-outpass-system.vercel.app',
  'https://hostel-outpass-system.onrender.com'
];  

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());    //parse incomming request with json payloads, so that we can access req.body in our routes.
app.use(express.urlencoded({ extended: true }));   // parses incomming requests with  form submissions.

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/outpass', outpassRoutes);
app.use('/api/contact', contactRoutes); // ✅ Step 2: mount route at /api/contact
 // ✅ Step 3: mount route for marking outpass as returned
app.use('/api', sendLateMailsRoutes);
app.use('/api/location', locationRoutes);



// ⚡ Add this at the END of app.js
app.use("/ws", (req, res) => {
  res.status(426).send("Upgrade Required");
});

// Export app
module.exports = app;

