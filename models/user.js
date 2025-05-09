import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  age: { type: Number, required: true, min: 14 },
  email: { type: String, required: true, unique: true },
  number: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  user_type: {
    type: String,
    enum: ['Admin', 'User', 'Trainer', 'Receptionist', 'Manager'],
    default: 'User'
  },
  // New permissions field:
  permissions: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  gymId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true },
});

// Hash the password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare passwords during login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to add a new role dynamically
userSchema.statics.addRole = function (role) {
  if (!this.schema.path('user_type').enumValues.includes(role)) {
    this.schema.path('user_type').enumValues.push(role);
  }
};

export default mongoose.model('User', userSchema);
