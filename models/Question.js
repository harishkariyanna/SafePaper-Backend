const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true
  },
  paperSetter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  guardians: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  encryptedData: {
    question: {
      type: String,
      required: true
    },
    options: [{
      type: String,
      required: true
    }],
    correctOption: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Drop all indexes and recreate only the ones we want
questionSchema.index({ questionId: 1 }, { unique: true });

module.exports = mongoose.model('Question', questionSchema);
