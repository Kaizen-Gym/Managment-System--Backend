import mongoose from "mongoose";

const gymSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
});

const Gym = mongoose.model("Gym", gymSchema);
export default Gym;
