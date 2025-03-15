import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym',
    required: true
  },
  gymName: String,
  gymAddress: String,
  contactEmail: String,
  contactPhone: String,
  backupFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  retentionPeriod: {
    type: Number,
    default: 30
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);