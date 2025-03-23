import express from "express";
import Role from "../models/role.js";
import protect from "../middleware/protect.js";
import logger from "../utils/logger.js";
import { AppError, handleError } from '../utils/errorHandler.js';

const router = express.Router();

// CREATE a new role
router.post("/roles", protect, async (req, res) => {
  try {
    const { roleName, defaultPermissions, currentPermissions } = req.body;

    if (!roleName) {
      throw new AppError('Role name is required', 400);
    }

    // Check if the role already exists
    const roleExists = await Role.findOne({ roleName });
    if (roleExists) {
      throw new AppError('Role already exists', 409);
    }

    const role = new Role({
      roleName,
      defaultPermissions: defaultPermissions || undefined,
      currentPermissions: currentPermissions || undefined,
    });

    await role.save();
    
    logger.info(`New role created: ${roleName} with permissions:`, {
      default: defaultPermissions,
      current: currentPermissions
    });
    
    res.status(201).json(role);
  } catch (error) {
    logger.error(`Error creating role: ${error.message}`);
    handleError(error, req, res);
  }
});

// READ (List all roles)
router.get("/roles", protect, async (req, res) => {
  try {
    const roles = await Role.find({});
    
    logger.info(`Retrieved ${roles.length} roles`);
    
    // Add pagination if needed
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;
    // const roles = await Role.find({})
    //   .skip((page - 1) * limit)
    //   .limit(limit);

    res.json(roles);
  } catch (error) {
    logger.error(`Error fetching roles: ${error.message}`);
    handleError(error, req, res);
  }
});

// UPDATE a role's permissions using roleName
router.put("/roles/:roleName", protect, async (req, res) => {
  try {
    const { defaultPermissions, currentPermissions } = req.body;
    const { roleName } = req.params;

    if (!roleName) {
      throw new AppError('Role name is required', 400);
    }

    const role = await Role.findOne({ roleName });
    if (!role) {
      throw new AppError('Role not found', 404);
    }

    // Track changes for logging
    const changes = {
      defaultPermissions: defaultPermissions !== undefined,
      currentPermissions: currentPermissions !== undefined
    };

    if (defaultPermissions) role.defaultPermissions = defaultPermissions;
    if (currentPermissions) role.currentPermissions = currentPermissions;
    
    await role.save();
    
    logger.info(`Role "${roleName}" updated`, {
      changes,
      updatedFields: {
        defaultPermissions: changes.defaultPermissions ? defaultPermissions : 'unchanged',
        currentPermissions: changes.currentPermissions ? currentPermissions : 'unchanged'
      }
    });

    res.json(role);
  } catch (error) {
    logger.error(`Error updating role: ${error.message}`);
    handleError(error, req, res);
  }
});

// DELETE a role
router.delete("/roles/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError('Role ID is required', 400);
    }

    const role = await Role.findById(id);
    if (!role) {
      throw new AppError('Role not found', 404);
    }

    // Optional: Add validation to prevent deletion of critical roles
    if (role.roleName === 'Admin') {
      throw new AppError('Cannot delete Admin role', 403);
    }

    await Role.deleteOne({ _id: id }); // Using deleteOne instead of remove()

    logger.info(`Role deleted: ${role.roleName}`, {
      roleId: id,
      permissions: {
        default: role.defaultPermissions,
        current: role.currentPermissions
      }
    });

    res.json({ 
      message: "Role removed successfully",
      deletedRole: {
        name: role.roleName,
        id: role._id
      }
    });
  } catch (error) {
    logger.error(`Error deleting role: ${error.message}`);
    handleError(error, req, res);
  }
});

// Optional: Add a route to get a specific role
router.get("/roles/:roleName", protect, async (req, res) => {
  try {
    const { roleName } = req.params;

    if (!roleName) {
      throw new AppError('Role name is required', 400);
    }

    const role = await Role.findOne({ roleName });
    if (!role) {
      throw new AppError('Role not found', 404);
    }

    logger.info(`Retrieved role details for: ${roleName}`);
    res.json(role);
  } catch (error) {
    logger.error(`Error fetching role details: ${error.message}`);
    handleError(error, req, res);
  }
});

export default router;