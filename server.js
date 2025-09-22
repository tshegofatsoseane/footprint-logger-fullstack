const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

const http = require('http');
const server = http.createServer(app); // why do we need this when we already have app???

const { Server } = require('socket.io');

const io = new Server(server, {
    cors: {
        origin: true, // TODO: fix this later, probably not secure
        credentials: true
    }
});

// simple map to hold userId... socketId (works for single server!!)
const userSocketMap = new Map();

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // frontend should emit "register" with rthe user's userId after obtaining token
    socket.on('register', (payload) => {
        try {
            const { userId } = payload || {};
            if (userId) {
                userSocketMap.set(userId.toString(), socket.id); // convert to string just in case
                console.log(`Registered socket ${socket.id} for user ${userId}`);
            }
        } catch (err) {
            console.warn('Socket register error', err);
        }
    });

    socket.on('disconnect', () => {
        // remove any mapping for this socket id
        for (const [uid, sid] of userSocketMap.entries()) {
            if (sid === socket.id) userSocketMap.delete(uid);
        }
        console.log('Socket disconnected:', socket.id);
    });
});


// helper to emit a tip to a particular userId
// adding this to app object because I couldn't figure out how to export it properly
app.emitTipToUser = function(userId, event, payload) {
    const sid = userSocketMap.get(String(userId));
    if (sid) {
        io.to(sid).emit(event, payload);
    }
};


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
