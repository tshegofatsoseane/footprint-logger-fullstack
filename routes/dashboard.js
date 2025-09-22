const express = require('express');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { authenticateToken } = require('./auth');
const { getWeekNumber } = require('./utils');

const router = express.Router();

// main dashboard route
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const activities = await Activity.find({ userId });

        let totalEmissions = 0;
        const emissionsByCategory = {};
        let weeklyEmissions = 0;

        const now = new Date();
        const currentWeek = getWeekNumber(now);
        const currentYear = now.getFullYear();

        // loop through activities to calculate stuff
        activities.forEach(activity => {
            totalEmissions += activity.co2;

            // put them in categories
            if (!emissionsByCategory[activity.category]) {
                emissionsByCategory[activity.category] = 0;
            }
            emissionsByCategory[activity.category] += activity.co2;

            // add the weeks emissions
            if (activity.week === currentWeek && activity.year === currentYear) {
                weeklyEmissions += activity.co2;
            }
        });

        // get the recent activities
        const recentActivities = activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        // community stuff, probably not the most efficient way but works for me
        const allActivities = await Activity.find({});
        const userEmissionTotals = {};
        
        allActivities.forEach(activity => {
            if (!userEmissionTotals[activity.userId]) {
                userEmissionTotals[activity.userId] = 0;
            }
            userEmissionTotals[activity.userId] += activity.co2;
        });

        const totalUsers = Object.keys(userEmissionTotals).length;
        const communityAverage = totalUsers > 0 
            ? Object.values(userEmissionTotals).reduce((sum, total) => sum + total, 0) / totalUsers
            : 0;

        // figure out where this user ranks
        const sortedUsers = Object.entries(userEmissionTotals)
            .sort(([, a], [, b]) => a - b);
        const userRank = sortedUsers.findIndex(([id]) => id === userId) + 1;

        res.json({
            totalEmissions,
            emissionsByCategory,
            weeklyEmissions,
            recentActivities,
            communityAverage,
            userRank,
            totalUsers
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ 
            error: "Failed to load dashboard data. Please try again." 
        });
    }
});

// streak calculation, this took me way too long to figure out
router.get('/streak', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const activities = await Activity.find({ userId });
        
        const currentYear = new Date().getFullYear();
        const emissionThreshold = 100; // todo: make this configurable

        // group activities by week
        const weeklyTotals = {};
        activities
            .filter(activity => activity.year === currentYear)
            .forEach(activity => {
                if (!weeklyTotals[activity.week]) {
                    weeklyTotals[activity.week] = 0;
                }
                weeklyTotals[activity.week] += activity.co2;
            });

        // sort weeks in descending order
        const sortedWeeks = Object.keys(weeklyTotals)
            .map(Number)
            .sort((a, b) => b - a);

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        sortedWeeks.forEach((week, index) => {
            if (weeklyTotals[week] < emissionThreshold) {
                tempStreak++;
                if (index === 0) {
                    currentStreak = tempStreak;
                }
            } else {
                // streak is broken, check if it was the longest
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
                if (index === 0) {
                    currentStreak = 0;
                }
            }
        });

        longestStreak = Math.max(longestStreak, tempStreak);

        res.json({ 
            currentStreak, 
            longestStreak, 
            threshold: emissionThreshold 
        });

    } catch (error) {
        console.error('Streak calculation error:', error);
        res.status(500).json({ 
            error: "Unable to calculate streak data" 
        });
    }
});

// leaderboard endpoint
router.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        const period = req.query.period || 'all';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const now = new Date();
        let query = {};

        // different time periods
        if (period === 'week') {
            const currentWeek = getWeekNumber(now);
            const currentYear = now.getFullYear();
            query = { week: currentWeek, year: currentYear };
        } else if (period === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            query = { 
                date: { 
                    $gte: startOfMonth, 
                    $lte: endOfMonth 
                } 
            }; 
        }

        const activities = await Activity.find(query);

        // calculate total emissions per user
        const userEmissions = {};
        activities.forEach(activity => {
            if (!userEmissions[activity.userId]) {
                userEmissions[activity.userId] = 0;
            }
            userEmissions[activity.userId] += activity.co2;
        });

        // get usernames for each user (will optimize later, for now it works!!)
        const leaderboardPromises = Object.entries(userEmissions).map(async ([userId, emissions]) => {
            try {
                const user = await User.findById(userId).select('username');
                return {
                    username: user?.username || 'Unknown User',
                    totalEmissions: emissions
                };
            } catch (err) {
                console.warn(`Couldn't find user ${userId}:`, err);
                return null;
            }
        });

        const leaderboardResults = await Promise.all(leaderboardPromises);
        
        // filter out null stuff and sort
        const leaderboard = leaderboardResults
            .filter(result => result !== null)
            .sort((a, b) => a.totalEmissions - b.totalEmissions)
            .slice(0, limit);

        res.json(leaderboard);

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ 
            error: 'Failed to load leaderboard data.' 
        });
    }
});

module.exports = router;