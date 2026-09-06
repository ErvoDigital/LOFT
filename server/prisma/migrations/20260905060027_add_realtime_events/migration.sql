-- CreateTable
CREATE TABLE "RealtimeEvent" (
    "id" SERIAL NOT NULL,
    "target" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealtimeEvent_createdAt_idx" ON "RealtimeEvent"("createdAt");
