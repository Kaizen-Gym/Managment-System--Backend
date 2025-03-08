import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true },
    // Default permissions for the role. You can change these if needed.
    defaultPermissions: {
      type: [String],
      default: [
        "view_dashboard",
        "view_members",
        "view_reports",
        "view_membership_plans",
        "view_settings",
        "manage_users",
      ],
    },
    // Current (active) permissions that can be edited independently.
    currentPermissions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Pre-save hook: if currentPermissions is empty, initialize it with the defaultPermissions
roleSchema.pre("save", function (next) {
  if (this.currentPermissions.length === 0) {
    this.currentPermissions = this.defaultPermissions;
  }
  next();
});

const Role = mongoose.model("Role", roleSchema);
export default Role;
