import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { answerAssistant, assertMembership, confirmAction } from "../services/assistant.service.js";
import { gatewayConfig } from "../services/openclaw.service.js";
import { synthesizeAssistantSpeech, transcribeAssistantAudio } from "../services/speech.service.js";

const router = Router();
router.use(requireAuth);
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 8 * 1024 * 1024 } });
const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  workspaceId: z.string().uuid().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }).strict()).max(12).default([]),
  timeZone: z.string().max(100).default("Asia/Manila").refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone"),
}).strict();
const contextSchema = z.object({ workspaceId: z.string().uuid().optional() }).strict();
const speechSchema = z.object({ text: z.string().trim().min(1).max(4000), workspaceId: z.string().uuid().optional(), voice: z.string().trim().min(1).max(60).optional() }).strict();

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
router.post("/transcribe", uploadAudio.single("audio"), async (req, res) => {
  const { workspaceId } = contextSchema.parse({ workspaceId: req.body?.workspaceId || undefined });
  if (workspaceId) await assertMembership(req.userId, workspaceId);
  if (!req.file) throw new ApiError(400, "Attach one audio clip as the 'audio' field.");
  if (!req.file.mimetype?.startsWith("audio/")) throw new ApiError(400, "Only audio files are supported.");
  res.json(await transcribeAssistantAudio({ audioBuffer: req.file.buffer, mimeType: req.file.mimetype, fileName: req.file.originalname }));
});
router.post("/speak", async (req, res) => {
  const { text, workspaceId, voice } = speechSchema.parse(req.body);
  if (workspaceId) await assertMembership(req.userId, workspaceId);
  const speech = await synthesizeAssistantSpeech({ text, voice });
  res.setHeader("Content-Type", speech.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.send(speech.bytes);
});
export default router;
