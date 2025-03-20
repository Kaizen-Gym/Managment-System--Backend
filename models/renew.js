import mongoose from "mongoose";
import Counter from "./Counter.js";

const renewSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String, required: true },
  number: { type: String, required: true }, // Changed from Number to String
  membership_type: {
    type: String,
    required: true,
    validate: {
      validator: async function (value) {
        const MembershipPlan = mongoose.model("MembershipPlan");
        const plan = await MembershipPlan.findOne({
          name: value,
          gymId: this.gymId,
        });
        return !!plan;
      },
      message: (props) => `${props.value} is not a valid membership type`,
    },
  },
  membership_amount: { type: Number, required: true, min: 0 },
  membership_due_amount: { type: Number, required: true, min: 0, default: 0 },
  membership_payment_status: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    required: true,
  },
  membership_payment_date: { type: Date, default: Date.now },
  membership_payment_mode: {
    type: String,
    enum: ["Cash", "Card", "UPI", "Bank Transfer"],
    required: true,
  },
  membership_end_date: { type: Date, required: true },

  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },

  is_due_payment: {
    type: Boolean,
    default: false,
  },

  payment_type: {
    type: String,
    enum: ["Membership Renewal", "Due Payment"],
    default: "Membership Renewal",
  },
});

renewSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      // Get and update the counter document for member IDs
      const counter = await Counter.findOneAndUpdate(
        { name: "memberId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      // Set the member id with "KN" prefix and the new sequence
      this.id = `KN${counter.seq}`;
    } catch (error) {
      next(error);
    }
  }
});

export default mongoose.model("Renew", renewSchema);
