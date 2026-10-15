import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { getPlanData } from "../services/planData.service.js";
import { recommendPlan } from "../services/planRecommendations.service.js";
import { prisma } from "../db/prisma.js";
import { createHash } from "node:crypto";

const capacitySchema = z.coerce.number().min(1).max(16);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value, "Invalid planned day");
const recommendationsSchema = z.object({
  capacity: capacitySchema.default(6),
  timeZone: z.string().max(100).default("Asia/Manila").refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone"),
  manual: z.object({ order: z.array(z.string().uuid()).max(1000), dates: z.record(z.string().uuid(), dateKey).refine((value) => Object.keys(value).length <= 1000) }).strict().optional(),
}).strict();
const active = new Set();
const recent = new Map();
const cachedAnalysis = new Map();

export async function getPlan(req, res) {
  const dailyCapacityHours = capacitySchema.default(6).parse(req.query.capacity);
  res.json(await getPlanData({ userId: req.userId, dailyCapacityHours }));
}

export async function getRecommendations(req, res) {
  const data = recommendationsSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { aiPriorityEnabled: true } });
  if (!user) throw new ApiError(401, "User not found");
  if (user.aiPriorityEnabled === false) return res.json({ enabled: false, order: [], items: [], summary: "Automatic AI priority analysis is off in your personal settings." });
  const plan = await getPlanData({ userId: req.userId, dailyCapacityHours: data.capacity });
  const input = { userId: req.userId, ...data, tasks: plan.tasks.map(({ score, ...task }) => task), events: plan.events, period: Math.floor(Date.now() / 600000) };
  const cacheKey = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const now = Date.now();
  for (const [key, value] of cachedAnalysis) if (value.until <= now) cachedAnalysis.delete(key);
  const cached = cachedAnalysis.get(cacheKey);
  if (cached) return res.json(cached.result);
  for (const [id, times] of recent) if (!times.some((time) => time > now - 60000)) recent.delete(id);
  const times = (recent.get(req.userId) || []).filter((time) => time > now - 60000);
  if (active.has(req.userId) || times.length >= 5) throw new ApiError(429, "Please wait before asking Lofty to review your plan again.");
  active.add(req.userId);
  recent.set(req.userId, [...times, now]);
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", cancel);
  try {
    const result = await recommendPlan(plan, { timeZone: data.timeZone, manual: data.manual, signal: controller.signal });
    if (!controller.signal.aborted && !res.destroyed) {
      cachedAnalysis.set(cacheKey, { result, until: Date.now() + 600000 });
      if (cachedAnalysis.size > 100) cachedAnalysis.delete(cachedAnalysis.keys().next().value);
      res.json(result);
    }
  } catch (err) {
    if (!controller.signal.aborted) throw err;
  } finally {
    active.delete(req.userId);
    res.off("close", cancel);
  }
}
