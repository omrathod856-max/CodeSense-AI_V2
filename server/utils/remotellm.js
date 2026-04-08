const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "https://jamey-poststernal-apprehensibly.ngrok-free.dev"; // Replace with your ngrok URL
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:latest";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 300000);
const LLM_PROMPT_MAX_CODE_CHARS = Number(process.env.LLM_PROMPT_MAX_CODE_CHARS || 80000);

/**
 * Basic timeout wrapper for fetch with ngrok bypass headers
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = OLLAMA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        // CRITICAL: This header bypasses the ngrok "browser warning" page 
        // that blocks automated API requests on free accounts.
        "ngrok-skip-browser-warning": "true",
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}