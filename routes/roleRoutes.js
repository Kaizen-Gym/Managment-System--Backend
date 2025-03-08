import express from "express";
import Role from "../models/role.js";
import protect from "../middleware/protect.js";
import logger from "../utils/logger.js";

const router = express.Router();

// CREATE a new role
router.post("/roles", protect, async (req, res) => {
  try {
    const { roleName, defaultPermissions, currentPermissions } = req.body;

    // Check if the role already exists
    const roleExists = await Role.findOne({ roleName });
    if (roleExists) {
      return res.status(409).json({ message: "Role already exists" });
    }

    const role = new Role({
      roleName,
      // Allow overrides; if not provided, defaults will be used
      defaultPermissions: defaultPermissions || undefined,
      currentPermissions: currentPermissions || undefined,
    });

    await role.save();
    logger.info(`Role created: ${roleName}`);
    res.status(201).json(role);
  } catch (error) {
    logger.error("Error creating role", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// READ (List all roles)
router.get("/roles", protect, async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json(roles);
  } catch (error) {
    logger.error("Error fetching roles", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// UPDATE a role's permissions
router.put("/roles/:id", protect, async (req, res) => {
  try {
    const { defaultPermissions, currentPermissions } = req.body;
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    if (defaultPermissions) role.defaultPermissions = defaultPermissions;
    if (currentPermissions) role.currentPermissions = currentPermissions;
    
    await role.save();
    logger.info(`Role updated: ${role.roleName}`);
    res.json(role);
  } catch (error) {
    logger.error("Error updating role", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE a role
router.delete("/roles/:id", protect, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    await role.remove();
    logger.info(`Role deleted: ${role.roleName}`);
    res.json({ message: "Role removed" });
  } catch (error) {
    logger.error("Error deleting role", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
