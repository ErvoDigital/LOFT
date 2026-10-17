import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { runReminderJob } from "../services/reminder.service.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();
router.get("/reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(req.get("Authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ApiError(401, "Unauthorized scheduler");
  res.json(await runReminderJob());
});
export default router;
