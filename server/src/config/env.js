import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve server/.env regardless of the directory used to start the API.
// Deployment environment variables keep precedence over this local file.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
