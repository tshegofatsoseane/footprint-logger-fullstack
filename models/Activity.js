const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['transport', 'food', 'energy']
    },
    activity: {
        type: String,
        required: true
    },
    activityText: {
        type: String,
        required: true
    },
    co2: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        default: Date.now
    },
    week: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    }
});

activitySchema.index({ userId: 1, date: -1 });
activitySchema.index({ week: 1, year: 1 });

module.exports = mongoose.model('Activity', activitySchema);



