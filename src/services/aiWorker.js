import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/**
 * JARVIS Local AI Worker
 * This runs in a separate thread to avoid freezing the ERP UI
 * and to prevent memory conflicts with React/Firebase.
 */
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => {
  handler.onmessage(msg);
};
