import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { answerAssistant, confirmAction } from "../services/assistant.service.js";
import { gatewayConfig } from "../services/openclaw.service.js";

const router = Router();
router.use(requireAuth);
const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  workspaceId: z.string().uuid().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }).strict()).max(12).default([]),
  timeZone: z.string().max(100).default("Asia/Manila").refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone"),
}).strict();

// Bound paid requests per authenticated user in each API process. A shared
// gateway/proxy rate limiter is still needed for a large replicated deployment.
const active = new Set();
const recent = new Map();
router.get("/status", (req, res) => res.json({ configured: Boolean(gatewayConfig().token) }));
router.post("/message", async (req, res) => {
  const data = requestSchema.parse(req.body);
  const now = Date.now();
  for (const [key, times] of recent) if (!times.some((t) => t > now - 60000)) recent.delete(key);
  const times = (recent.get(req.userId) || []).filter((t) => t > now - 60000);
  if (active.has(req.userId) || times.length >= 10) throw new ApiError(429, "Please wait before sending another assistant message.");
  recent.set(req.userId, [...times, now]);
  active.add(req.userId);
  try { res.json(await answerAssistant({ ...data, userId: req.userId })); }
  finally { active.delete(req.userId); }
});
router.post("/confirm", async (req, res) => {
  const { token } = z.object({ token: z.string().min(1).max(12000) }).strict().parse(req.body);
  res.json(await confirmAction(token, req.userId));
});
export default router;
