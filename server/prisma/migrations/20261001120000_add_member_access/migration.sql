-- Per-member access: a custom title shown in place of the role, and the admin
-- abilities granted to a non-admin member, stored as a comma-separated list of
-- keys (see server/src/services/permissions.js).
ALTER TABLE "WorkspaceMember" ADD COLUMN "title" TEXT;
ALTER TABLE "WorkspaceMember" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '';

-- MANAGER is folded into MEMBER. All it ever unlocked was removing members
-- and being told when someone joined, which is now the members.manage
-- ability, so existing managers keep exactly that and keep "Manager" as their
-- title.
UPDATE "WorkspaceMember"
SET "role" = 'MEMBER', "permissions" = 'members.manage', "title" = 'Manager'
WHERE "role" = 'MANAGER';
