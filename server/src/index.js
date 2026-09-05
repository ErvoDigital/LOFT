import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import { initSockets } from "./sockets/chat.socket.js";
import { startReminderJob } from "./services/reminder.service.js";

const PORT = process.env.PORT || 4000;

const app = createApp();
const httpServer = http.createServer(app);

initSockets(httpServer, process.env.CLIENT_URL);
startReminderJob();

httpServer.listen(PORT, () => {
  console.log(`LOFT API listening on http://localhost:${PORT}`);
});
