const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// jwt validation
//todo: doesn't work on postman(will fix later!!)
function authenticateToken(req, res, next) {   
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    // coz token comes with "Bearer"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // verify the token
    jwt.verify(token, process.env.JWT_SECRET, function(err, user) {
        if (err) {
            return res.status(403).json({ error: 'Token is invalid or expired' });
        }

        req.user = user;
        next();
    });
}

// registration
router.post('/register', async function(req, res) {
    const { username, email, password } = req.body;

    // validate input
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'enter all fields!!' }); // come back to this, to add double password vallidation!! it works for now!! 
    }

    try {
        // check if user exists in the database
        const existingUser = await User.findOne({
            $or: [{ email: email }, { username: username }]
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'user exists!!' });
        }

        // create new user
        const newUser = new User({
            username: username,
            email: email,
            password: password
        });

        await newUser.save();

        // generate JWT token
        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } //not sure to make it shorter or longer
        );

        res.status(201).json({
            token: token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Something went wrong during registration' });
    }
});

//login 
router.post('/login', async function(req, res) {

//todo: gonna add authentication by email(2 factor auth stuff) for now thisnworks!!

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please fill all fields' });
    }

    try {
        // find user by email
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token: token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// get user
router.get('/me', authenticateToken, async function(req, res) {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);

    } catch (err) {
        console.error('Error getting user profile:', err);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// logout(browser should delete the token)
//todo: test on postman if it works
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;