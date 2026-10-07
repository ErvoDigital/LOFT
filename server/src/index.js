import "./config/env.js";
import http from "http";
import { createApp } from "./app.js";
import { initSockets } from "./sockets/chat.socket.js";
import { startReminderJob } from "./services/reminder.service.js";
import { verifyMailConnection } from "./services/mail.service.js";
import { clientOrigins } from "./config/clientOrigins.js";

const PORT = process.env.PORT || 4000;

const app = createApp();
const httpServer = http.createServer(app);

initSockets(httpServer, clientOrigins());
startReminderJob();

httpServer.listen(PORT, () => {
  console.log(`LOFT API listening on http://localhost:${PORT}`);
  verifyMailConnection()
    .then(() => console.log("SMTP connection verified"))
    .catch((error) => console.error(error.message));
});
