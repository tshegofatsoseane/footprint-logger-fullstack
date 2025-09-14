const express = require('express');
const Activity = require('../models/Activity');
const { authenticateToken } = require('./auth');
const { getWeekNumber } = require('./utils');

const router = express.Router();

// hardcoded activity data, i'll move this to a database eventually(works for now!!)
const activityData = {
    transport: {
        "Personal car (Petro/diesel)": { text: "Personal car (Petro/diesel)", co2: 0.15 },
        "taxi or uber/Bolt": { text: "Taxi or Uber/Bolt", co2: 0.18 },
        "airplane flight": { text: "Airplane flight", co2: 0.25 },
        "Scooter": { text: "Scooter", co2: 0.07 },
        "Electric cars": { text: "Electric cars", co2: 0.10 }
    },
    food: {
        "Beef": { text: "Beef", co2: 27 },
        "Chicken": { text: "Chicken", co2: 6 },
        "cheese": { text: "Cheese", co2: 10 },
        "Eggs": { text: "Eggs", co2: 4.5 },
        "Cold drink(coca-cola, sprite etc)": { text: "Cold drink (Coca-Cola, Sprite etc)", co2: 0.3 }
    },
    energy: {
        "TV/computer": { text: "TV/Computer", co2: 0.05 },
        "washing machine": { text: "Washing machine", co2: 1.8 },
        "house Lights": { text: "House lights", co2: 0.01 },
        "Fridge": { text: "Fridge", co2: 0.5 },
        "heater": { text: "Heater", co2: 8 },
        "gas heater": { text: "Gas heater", co2: 1 },
        "charging phone": { text: "Charging phone", co2: 0.01 }
    }
};

// create new activity
//todo: test on postman if it works
router.post('/', authenticateToken, async function(req, res) {
    try {
        const category = req.body.category;
        const activity = req.body.activity;

        if (!category || !activity) {
            return res.status(400).json({ error: "Category and activity are required" });
        }

        // check if the category exists
        let info;
        if (activityData[category]) {
            info = activityData[category][activity];
        }

        if (!info) {
            return res.status(400).json({ error: "Invalid category or activity" });
        }

        const now = new Date();
        const newActivity = new Activity({
            userId: req.user.userId,
            category: category,
            activity: activity,
            activityText: info.text,
            co2: info.co2,
            date: now,
            week: getWeekNumber(now),
            year: now.getFullYear()
        });

        // save to database
        await newActivity.save();

        res.status(201).json({
            message: "Activity added successfully",
            activity: newActivity
        });

    } catch (error) {
        console.log("Error adding activity:", error);
        res.status(500).json({ error: "Something went wrong while saving activity" });
    }
});

// get activities
router.get('/', authenticateToken, async function(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const category = req.query.category;

        const userId = req.user.userId;

        const query = { userId: userId };

        if (category && category !== 'all') {
            query.category = category;
        }

        const activities = await Activity.find(query)
            .sort({ date: -1 })  // newest first
            .skip((page - 1) * limit)  
            .limit(limit);  

        const total = await Activity.countDocuments(query);

        res.json({
            activities: activities,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total: total
        });

    } catch (error) {
        console.log('Error fetching activities:', error);
        res.status(500).json({ error: 'Something went wrong while fetching activities' });
    }
});

// delete activity (Will optimize before due date)
router.delete('/:id', authenticateToken, async function(req, res) {
    try {
        const activityId = req.params.id;
        const userId = req.user.userId;

        // make sure the activity exists and belongs to the user
        const activity = await Activity.findOne({ _id: activityId, userId: userId });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found or you dont have permission to delete it' });
        }

        // delete it
        await Activity.findByIdAndDelete(activityId);

        res.json({ message: 'Activity deleted successfully' });

    } catch (error) {
        console.log('Error deleting activity:', error);
        res.status(500).json({ error: 'Something went wrong while deleting activity' });
    }
});

// get available categories and activities
router.get('/categories', (req, res) => {
    try {
        res.json(activityData);
    } catch (error) {
        console.log('Error getting categories:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

module.exports = router;