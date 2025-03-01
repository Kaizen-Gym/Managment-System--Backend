import mongoose from "mongoose";

const renewSchema = new mongoose.Schema({
  id: { type: String, required: true },
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
  membership_payment_status: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    required: true,
  },
  membership_payment_date: { type: Date, default: Date.now },
  membership_payment_mode: {
    type: String,
    enum: ["Cash", "Card", "Online"],
    required: true,
  },
  membership_end_date: { type: Date, required: true },

  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
});

export default mongoose.model("Renew", renewSchema);
