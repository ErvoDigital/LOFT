-- Email-verification code for changing/setting a password from the Profile
-- page. Kept separate from resetToken/resetTokenExpiry (see schema.prisma)
-- since that column is looked up unscoped across all users by the
-- forgot-password flow, and this is a much lower-entropy 6-digit code.

ALTER TABLE "User" ADD COLUMN "passwordChangeCode" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordChangeCodeExpiry" TIMESTAMP(3);
