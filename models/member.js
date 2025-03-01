import mongoose from "mongoose";
import Counter from "./Counter.js";

const memberScheme = new mongoose.Schema({
  id: { type: String, unique: true },
  name: { type: String, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  age: { type: Number, required: true, min: 14 },
  email: { type: String, unique: true },
  number: { type: String, required: true, unique: true },
  member_total_payment: { type: Number, required: true, min: 0, default: 0 },
  createdAt: { type: Date, default: Date.now },

  // Instead of a fixed enum, we'll validate against MembershipPlan names
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
  membership_status: {
    type: String,
    enum: ["Active", "Inactive", "Expired"],
    required: true,
  },
  membership_start_date: { type: Date, required: true },
  membership_end_date: { type: Date, required: true },
  membership_duration: { type: Number, required: true },
  membership_amount: { type: Number, required: true, min: 0 },
  membership_payment_status: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    required: true,
  },
  membership_payment_date: { type: Date },
  membership_payment_mode: {
    type: String,
    enum: ["Cash", "Card", "Online"],
    required: false,
  },
  membership_payment_reference: { type: String, required: false },

  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
});

// Add a pre-save middleware to set amount and duration from the plan
memberScheme.pre("save", async function (next) {
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

  if (this.isModified("membership_type")) {
    try {
      const MembershipPlan = mongoose.model("MembershipPlan");
      const plan = await MembershipPlan.findOne({
        name: this.membership_type,
        gymId: this.gymId,
      });

      if (plan) {
        this.membership_amount = plan.price;
        this.membership_duration = plan.duration;

        // Calculate end date based on plan duration
        const endDate = new Date(this.membership_start_date);
        endDate.setMonth(endDate.getMonth() + plan.duration);
        this.membership_end_date = endDate;
      }
    } catch (error) {
      next(error);
    }
  }
  next();
});

export default mongoose.model("member", memberScheme);
