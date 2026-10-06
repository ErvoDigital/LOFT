import { randomUUID } from "node:crypto";
import { ApiError } from "../utils/ApiError.js";

export function gatewayConfig(env = process.env) {
  return { url: env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789", token: env.OPENCLAW_GATEWAY_TOKEN };
}

// Each turn gets an isolated session. Only continuations within that turn share it.
// Never accept a gateway session ID or previous_response_id from the browser.
export async function runOpenClaw({ message, history, instructions, tools, executeTool, fetchImpl = fetch, config = gatewayConfig() }) {
  if (!config.token) throw new ApiError(503, "Lofty needs setup. Run npm run ai:setup and start the OpenClaw gateway.");
  const session = `loft:${randomUUID()}`;
  let input = [...history.map(({ role, content }) => `${role}: ${content}`), `user: ${message}`].join("\n");
  let previousResponseId;
  const signal = AbortSignal.timeout(90000);
  for (let round = 0; round < 6; round++) {
    let response;
    try {
      response = await fetchImpl(`${config.url.replace(/\/$/, "")}/v1/responses`, {
        method: "POST", signal, redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}`, "x-openclaw-session-key": session },
        body: JSON.stringify({ model: "openclaw", input, instructions, tools, tool_choice: "auto", max_output_tokens: 1800, ...(previousResponseId ? { previous_response_id: previousResponseId } : {}) }),
      });
    } catch {
      throw new ApiError(503, "OpenClaw is unavailable or timed out. Check that the gateway is running.");
    }
    if (!response.ok) throw new ApiError(502, "OpenClaw could not answer. Check the gateway logs and OpenRouter key or credits.");
    let data;
    try { data = await response.json(); } catch { throw new ApiError(502, "OpenClaw returned an invalid response."); }
    if (data.error || data.status === "failed" || data.status === "incomplete" || !Array.isArray(data.output)) throw new ApiError(502, "OpenClaw could not complete the response. Try a shorter request.");
    const calls = data.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      const reply = data.output.filter((item) => item.type === "message").flatMap((item) => item.content || []).filter((part) => part.type === "output_text").map((part) => part.text).join("\n");
      if (!reply) throw new ApiError(502, "OpenClaw returned no answer. Try a model that supports tools.");
      return reply;
    }
    if (calls.length > 8 || !data.id) throw new ApiError(502, "OpenClaw returned too many actions or an invalid continuation.");
    previousResponseId = data.id;
    input = "";
    for (const call of calls) {
      let output;
      try { output = await executeTool(call.name, JSON.parse(call.arguments)); }
      catch (err) { output = { error: err instanceof ApiError ? err.message : "Invalid tool arguments or tool unavailable." }; }
      input += `\nTool ${call.name} result: ${JSON.stringify(output)}`;
    }
  }
  throw new ApiError(502, "The assistant needed too many steps. Try a more specific request.");
}
