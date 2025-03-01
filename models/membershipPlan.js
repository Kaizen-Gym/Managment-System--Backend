import mongoose from 'mongoose';

const membershipPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number, // in months
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  features: [{
    type: String,
    trim: true
  }],
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Gym'
  }
}, {
  timestamps: true
});

export default mongoose.model('MembershipPlan', membershipPlanSchema);