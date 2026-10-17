import { Router } from "express";
import { createHmac } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";

export function meetingIceConfig(userId, env = process.env, now = Date.now()) {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = (env.TURN_URLS || "").split(",").map((url) => url.trim()).filter((url) => /^turns?:[^\s]+$/.test(url));
  if (urls.length && env.TURN_SHARED_SECRET) {
    const username = `${Math.floor(now / 1000) + 3600}:${userId}`;
    iceServers.push({ urls, username, credential: createHmac("sha1", env.TURN_SHARED_SECRET).update(username).digest("base64") });
  }
  return { iceServers, relayConfigured: iceServers.length > 1, expiresAt: new Date(now + 3600000).toISOString() };
}
const router = Router();
router.use(requireAuth);
router.get("/ice", (req, res) => res.json(meetingIceConfig(req.userId)));
export default router;
