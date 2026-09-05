import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { prisma } from "../db/prisma.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) throw new ApiError(401, "Missing authentication token");

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

// Loads the caller's membership for req.params.workspaceId onto req.membership.
// Optionally restricts access to a set of roles.
export function requireWorkspaceMember(allowedRoles) {
  return async (req, res, next) => {
    const workspaceId = req.params.workspaceId;
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId } },
    });

    if (!membership) throw new ApiError(403, "You are not a member of this workspace");
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }

    req.membership = membership;
    next();
  };
}
