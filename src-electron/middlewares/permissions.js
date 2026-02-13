import { getDB } from "../database.js";

/**
 * Middleware to check if a user has a specific permission
 * @param {string} permission - The permission to check (e.g., 'canAccessJournal')
 * @returns {Function} Express middleware function
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    const db = getDB();
    const username =
      req.headers["x-username"] ||
      req.body.username ||
      req.body.createdBy ||
      req.query.username;

    if (!username) {
      return res.status(400).json({
        error: "Username is required for permission check",
      });
    }

    try {
      // Find user with their accesses
      const user = await db.models.Users.findOne({
        where: { username },
        include: {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.autorised) {
        return res.status(403).json({ error: "User not authorized" });
      }

      // Admin and technician bypass permission checks
      if (user.isAdmin || user.isTechnician) {
        req.userId = user.id;
        req.user = user;
        return next();
      }

      // Check if user has the required permission
      const hasPermission = user.UserAccesses.some(
        (access) => access.menuId === permission
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Permission denied: ${permission} required`,
          required: permission,
        });
      }

      // Attach user info to request
      req.userId = user.id;
      req.user = user;

      // Permission granted
      next();
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ error: error.message });
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
export const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    const db = getDB();
    const username =
      req.headers["x-username"] ||
      req.body.username ||
      req.body.createdBy ||
      req.query.username;

    if (!username) {
      return res.status(400).json({
        error: "Username is required for permission check",
      });
    }

    try {
      const user = await db.models.Users.findOne({
        where: { username },
        include: {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.autorised) {
        return res.status(403).json({ error: "User not authorized" });
      }

      // Admin and technician bypass permission checks
      if (user.isAdmin || user.isTechnician) {
        req.userId = user.id;
        req.user = user;
        return next();
      }

      // Check if user has any of the required permissions
      const hasPermission = user.UserAccesses.some((access) =>
        permissions.includes(access.menuId)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Permission denied: one of [${permissions.join(
            ", "
          )}] required`,
          required: permissions,
        });
      }

      // Attach user info to request
      req.userId = user.id;
      req.user = user;

      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      res.status(500).json({ error: error.message });
    }
  };
};

/**
 * Middleware to check if user is Admin only
 */
export const requireAdmin = async (req, res, next) => {
  const db = getDB();
  const username =
    req.headers["x-username"] ||
    req.body.username ||
    req.query.username;

  if (!username) {
    return res.status(400).json({
      error: "Username is required for admin check",
    });
  }

  try {
    const user = await db.models.Users.findOne({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.autorised) {
      return res.status(403).json({ error: "User not authorized" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ 
        error: "Admin access required" 
      });
    }

    // Attach user info to request
    req.userId = user.id;
    req.user = user;

    next();
  } catch (error) {
    console.error("Error checking admin access:", error);
    res.status(500).json({ error: error.message });
  }
};
