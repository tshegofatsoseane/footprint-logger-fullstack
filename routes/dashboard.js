const express = require('express');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { authenticateToken } = require('./auth');
const { getWeekNumber } = require('./utils');
const Goal = require('../models/Goal'); 

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

router.get('/insights', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();
        const currentWeek = getWeekNumber(now);
        const currentYear = now.getFullYear();

        // Fetch activities for this user for the current week and year
        const weeklyActivities = await Activity.find({ userId, week: currentWeek, year: currentYear });

        let activitiesToAnalyze = weeklyActivities;
        if (!activitiesToAnalyze || activitiesToAnalyze.length === 0) {
            const fourWeeksAgo = new Date(now);
            fourWeeksAgo.setDate(now.getDate() - 28);
            activitiesToAnalyze = await Activity.find({
                userId,
                date: { $gte: fourWeeksAgo, $lte: now }
            });
        }

        // calculate emissions by category
        const emissionsByCategory = {};
        activitiesToAnalyze.forEach(a => {
            emissionsByCategory[a.category] = (emissionsByCategory[a.category] || 0) + a.co2;
        });

        if (Object.keys(emissionsByCategory).length === 0) {
            const tip = "No activity logged yet — try adding an activity so we can give you a personalised tips!";
            return res.json({
                tip,
                goal: null,
                emissionsByCategory: {}
            });
        }

        // find highest category
        let highestCategory = null;
        let highestKg = 0;
        for (const [cat, kg] of Object.entries(emissionsByCategory)) {
            if (kg > highestKg) {
                highestKg = kg;
                highestCategory = cat;
            }
        }

        // TODO: create simple tip and a target reduction
        const reductionFraction = 0.10; // 10% target reduction
        const targetReductionKg = +(highestKg * reductionFraction).toFixed(2);

        // craft a short personalised tip (simple heuristics)
        let tip = '';
        if (highestCategory === 'transport') {
            tip = `Try swapping one short car trip for cycling or walking this week — estimated saving ~${targetReductionKg} kg CO2.`;
        } else if (highestCategory === 'food') {
            tip = `Choose one or two plant-based meals this week instead of high-emission foods — estimated saving ~${targetReductionKg} kg CO2.`;
        } else if (highestCategory === 'energy') {
            tip = `Unplug unused devices or lower heating slightly this week — estimated saving ~${targetReductionKg} kg CO2.`;
        } else {
            tip = `Try reducing usage in ${highestCategory} this week to cut ~${targetReductionKg} kg CO2.`;
        }

        // goal document for this user/week/year
        const goalFilter = { userId, week: currentWeek, year: currentYear };
        const goalUpdate = {
            userId,
            week: currentWeek,
            year: currentYear,
            category: highestCategory,
            targetReductionKg,
            tip
        };

        const goalOptions = { upsert: true, new: true, setDefaultsOnInsert: true };
        let goal = await Goal.findOneAndUpdate(goalFilter, goalUpdate, goalOptions);

        // calculate progress
        // take the average emissions in the chosen category from the past 4 weeks, then compare it with this week's total.
        const lookbackDate = new Date(now);
        lookbackDate.setDate(now.getDate() - 28); // 4 weeks
        const lookbackActivities = await Activity.find({
            userId,
            category: highestCategory,
            date: { $gte: lookbackDate, $lt: now }
        });

        let baseline = 0;
        if (lookbackActivities.length > 0) {
            baseline = lookbackActivities.reduce((s, a) => s + a.co2, 0) / 4; // average per week approx
        }

        // current week total for that category:
        const currentCategoryTotal = emissionsByCategory[highestCategory] || 0;
        let currentProgressKg = 0;
        if (baseline > 0) {
            const avoided = Math.max(0, baseline - currentCategoryTotal);
            currentProgressKg = +Math.min(avoided, targetReductionKg).toFixed(2);
        } else {
            //no progress yet
            currentProgressKg = 0;
        }

        goal.currentProgressKg = currentProgressKg;
        await goal.save();

        // send a real-time tip to the user!(works!)
        try {
            if (req.app && typeof req.app.emitTipToUser === 'function') {
                req.app.emitTipToUser(userId, 'insightTip', {
                    tip,
                    goal: {
                        category: goal.category,
                        targetReductionKg: goal.targetReductionKg,
                        currentProgressKg: goal.currentProgressKg,
                        week: goal.week,
                        year: goal.year
                    }
                });
            }
        } catch (err) {
            console.warn('Could not push socket tip', err);
        }

        res.json({
            tip,
            goal,
            emissionsByCategory
        });

    } catch (error) {
        console.error('/insights error', error);
        res.status(500).json({ error: 'Failed to generate insights' });
    }
});

// endpoint to mark progress ( gonna test with postman later)
router.post('/goal/progress', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amountKg } = req.body; // number

        if (!amountKg || isNaN(amountKg) || amountKg <= 0) {
            return res.status(400).json({ error: 'Invalid amountKg' });
        }

        const now = new Date();
        const currentWeek = getWeekNumber(now);
        const currentYear = now.getFullYear();

        const goal = await Goal.findOne({ userId, week: currentWeek, year: currentYear });
        if (!goal) {
            return res.status(404).json({ error: 'No active goal found for this week' });
        }

        goal.currentProgressKg = Math.min(goal.targetReductionKg, (goal.currentProgressKg || 0) + Number(amountKg));
        await goal.save();

        // notify via socket of updated progress
        try {
            if (req.app && typeof req.app.emitTipToUser === 'function') {
                req.app.emitTipToUser(userId, 'goalUpdated', { currentProgressKg: goal.currentProgressKg, targetReductionKg: goal.targetReductionKg });
            }
        } catch (err) {}

        res.json({ goal });
    } catch (err) {
        console.error('/goal/progress error', err);
        res.status(500).json({ error: 'Failed to update goal progress' });
    }
});

module.exports = router;

// Todo: right now i'm fetching all activities for community avarage,
//.      this will will be slow as the db grows(will optimize later!)