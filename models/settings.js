import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gym",
      required: true,
      unique: true,
    },
    gymName: {
      type: String,
      required: [true, "Gym name is required"],
      trim: true,
      minlength: [2, "Gym name must be at least 2 characters long"],
    },
    gymAddress: {
      type: String,
      required: [true, "Gym address is required"],
      trim: true,
      minlength: [5, "Address must be at least 5 characters long"],
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
      match: [/^\d{10}$/, "Please provide a valid 10-digit phone number"],
    },
    // You can add more settings fields here as needed
  },
  {
    timestamps: true,
  },
);

settingsSchema.pre("save", function (next) {
  // Remove any non-digit characters from phone number
  this.contactPhone = this.contactPhone.replace(/\D/g, "");
  next();
});

export default mongoose.model("Settings", settingsSchema);
