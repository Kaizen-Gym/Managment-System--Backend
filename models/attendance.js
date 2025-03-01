import mongoose from "mongoose";
const attendanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    number: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date },
    attendanceType: {
      type: String,
      enum: ["In-Person", "Virtual"],
      default: "In-Person",
    },
    gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  },
  { timestamps: true },
);
export default mongoose.model("Attendance", attendanceSchema);
