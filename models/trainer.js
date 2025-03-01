import mongoose from "mongoose";

const trainerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  number: { type: String, required: true, unique: true },
  specialization: { type: String, required: true },
  experience: { type: Number, default: 0 },
  certifications: { type: [String], default: [] },
  schedule: [
    {
      day: {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        required: true,
      },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },

  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
});

export default mongoose.model("Trainer", trainerSchema);
