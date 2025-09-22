const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
    },
  week: { 
    type: Number, 
    required: true 
    },
  year: { 
    type: Number, 
    required: true
    },
  category: { 
    type: String, 
    required: true 
    },
  targetReductionKg: { 
    type: Number, 
    required: true 
    }, // how many kg CO2 to cut this week
  currentProgressKg: { 
    type: Number, 
    default: 0 
    }, // how many kg user has already reduced
  tip: { 
    type: String 
    },
  createdAt: { type: Date, default: Date.now }
});

// Ensure one goal per user/week
GoalSchema.index({ userId: 1, week: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Goal', GoalSchema);
