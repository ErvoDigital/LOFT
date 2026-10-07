CREATE TABLE "EmailChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailChallenge_userId_purpose_key" ON "EmailChallenge"("userId", "purpose");

ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
