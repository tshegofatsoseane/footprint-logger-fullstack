const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
//todo: add this to .env
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// MongoDB connection
//todo: add this to .env
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/footprint-logger', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// routes
// todo: test routes on postman if they work
app.use('/api/auth', require('./routes/auth'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/dashboard', require('./routes/dashboard'));

// serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
