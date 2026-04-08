const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "https://osteoblastic-hyperfine-keira.ngrok-free.dev";
const OLLAMA_CHAT_PATH = process.env.OLLAMA_CHAT_PATH || "/api/chat";
const OLLAMA_FALLBACK_BASE_URL = process.env.OLLAMA_FALLBACK_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 300000);
const LLM_PROMPT_MAX_CODE_CHARS = Number(process.env.LLM_PROMPT_MAX_CODE_CHARS || 80000);
const OLLAMA_AUTH_TOKEN = process.env.OLLAMA_AUTH_TOKEN || "";

const INTERVIEW_JSON_SCHEMA = {
  type: "object",
  required: ["summary", "questions", "hands_on_task", "follow_ups"],
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1 },
    questions: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        required: ["type", "question", "expected_points", "difficulty"],
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["conceptual", "code-reading", "debugging", "design"],
          },
          question: { type: "string", minLength: 1 },
          expected_points: {
            type: "array",
            minItems: 2,
            items: { type: "string", minLength: 1 },
          },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
      },
    },
    hands_on_task: {
      type: "object",
      required: ["prompt", "evaluation_rubric"],
      additionalProperties: false,
      properties: {
        prompt: { type: "string", minLength: 1 },
        evaluation_rubric: {
          type: "array",
          minItems: 3,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    follow_ups: {
      type: "array",
      minItems: 3,
      items: { type: "string", minLength: 1 },
    },
  },
};

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function normalizePath(path) {
  const safe = String(path || "").trim();
  if (!safe) return "/api/chat";
  return safe.startsWith("/") ? safe : `/${safe}`;
}

function buildChatUrl() {
  return `${normalizeBaseUrl(OLLAMA_BASE_URL)}${normalizePath(OLLAMA_CHAT_PATH)}`;
}

function buildFallbackChatUrl() {
  if (!OLLAMA_FALLBACK_BASE_URL) return "";
  return `${normalizeBaseUrl(OLLAMA_FALLBACK_BASE_URL)}${normalizePath(OLLAMA_CHAT_PATH)}`;
}

function buildRequestHeaders(extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (OLLAMA_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${OLLAMA_AUTH_TOKEN}`;
  }

  return headers;
}

function clampPromptCode(code, maxChars = LLM_PROMPT_MAX_CODE_CHARS) {
  if (typeof code !== "string") return "";
  if (code.length <= maxChars) return code;
  return `${code.slice(0, maxChars)}\n\n<!-- Code context truncated to ${maxChars} chars before LLM call -->`;
}

function isNgrokOfflineResponse(status, body) {
  return (
    status === 404 &&
    typeof body === "string" &&
    (body.includes("ERR_NGROK_3200") || body.toLowerCase().includes("endpoint") && body.toLowerCase().includes("offline"))
  );
}

async function runChatRequest(chatUrl, payload) {
  const res = await fetchWithTimeout(chatUrl, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    const error = new Error(
      `Ollama API error (${res.status}) at ${chatUrl}: ${errorText || res.statusText}`
    );
    error.status = res.status;
    error.errorText = errorText;
    throw error;
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (!content) {
    throw new Error(`Invalid Ollama response at ${chatUrl}: missing message.content`);
  }

  return content;
}

/**
 * Basic timeout wrapper for fetch
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = OLLAMA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: buildRequestHeaders(options.headers || {}),
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generic Ollama chat call
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {{ model?: string, temperature?: number, stream?: boolean }} opts
 */
async function callLLM(messages, opts = {}) {
  const model = opts.model || OLLAMA_MODEL;
  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.3;
  const stream = Boolean(opts.stream ?? false);
  const format = opts.format;
  const chatUrl = opts.baseUrl
    ? `${normalizeBaseUrl(opts.baseUrl)}${normalizePath(opts.chatPath || OLLAMA_CHAT_PATH)}`
    : buildChatUrl();
  const payload = {
    model,
    messages,
    stream,
    ...(format ? { format } : {}),
    options: {
      temperature,
    },
  };

  try {
    return await runChatRequest(chatUrl, payload);
  } catch (error) {
    const fallbackUrl = buildFallbackChatUrl();
    const canFallback =
      fallbackUrl &&
      fallbackUrl !== chatUrl &&
      (isNgrokOfflineResponse(error.status, error.errorText) || error.name === "AbortError");

    if (canFallback) {
      return runChatRequest(fallbackUrl, payload);
    }

    if (isNgrokOfflineResponse(error.status, error.errorText)) {
      throw new Error(
        `Remote ngrok endpoint is offline (${chatUrl}). Ask your friend to restart ngrok tunnel and share the new URL, or set OLLAMA_BASE_URL to a live endpoint.`
      );
    }

    throw error;
  }
}

function parseInterviewJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Empty model response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    // Continue with extraction fallback.
  }

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with object slice fallback.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1);
    return JSON.parse(sliced);
  }

  throw new Error("Model response was not valid JSON.");
}

function isValidInterviewPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const hasSummary = typeof payload.summary === "string" && payload.summary.trim().length > 0;
  const hasQuestions = Array.isArray(payload.questions) && payload.questions.length > 0;
  const hasHandsOnTask =
    payload.hands_on_task &&
    typeof payload.hands_on_task === "object" &&
    typeof payload.hands_on_task.prompt === "string" &&
    payload.hands_on_task.prompt.trim().length > 0;
  const hasFollowUps = Array.isArray(payload.follow_ups);

  return hasSummary && hasQuestions && hasHandsOnTask && hasFollowUps;
}

/**
 * Build a structured prompt for converting code into interview content
 */
function buildCodeToInterviewPrompt({ code, language, role, difficulty, focusAreas }) {
  const focus = Array.isArray(focusAreas) && focusAreas.length
    ? focusAreas.join(", ")
    : "problem solving, code quality, debugging, system thinking";

  return [
    "You are an expert technical interviewer.",
    "Convert the given source code into a practical interview kit.",
    "",
    "Return STRICT JSON with this schema:",
    "{",
    '  "summary": "short code summary",',
    '  "questions": [',
    '    { "type": "conceptual|code-reading|debugging|design", "question": "...", "expected_points": ["..."], "difficulty": "easy|medium|hard" }',
    "  ],",
    '  "hands_on_task": { "prompt": "...", "evaluation_rubric": ["..."] },',
    '  "follow_ups": ["..."]',
    "}",
    "",
    `Target role: ${role || "Software Engineer"}`,
    `Difficulty: ${difficulty || "medium"}`,
    `Primary language: ${language || "unknown"}`,
    `Focus areas: ${focus}`,
    "",
    "Source code:",
    code || "",
  ].join("\n");
}

/**
 * Main utility: convert code -> interview content
 */
async function generateInterviewFromCode({
  code,
  language = "javascript",
  role = "Software Engineer",
  difficulty = "medium",
  focusAreas = [],
  model,
}) {
  if (!code || typeof code !== "string") {
    throw new Error("generateInterviewFromCode requires a non-empty 'code' string.");
  }

  const safeCode = clampPromptCode(code);

  const systemPrompt =
    "You generate high-quality, fair, and practical technical interviews. Output only valid JSON.";
  const userPrompt = buildCodeToInterviewPrompt({
    code: safeCode,
    language,
    role,
    difficulty,
    focusAreas,
  });

  const raw = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { model, temperature: 0.1, stream: false, format: INTERVIEW_JSON_SCHEMA }
  );

  try {
    const parsed = parseInterviewJson(raw);
    if (isValidInterviewPayload(parsed)) {
      return parsed;
    }
  } catch {
    // Continue to repair and regeneration fallbacks.
  }

  // One repair pass: ask model to transform previous output into strict JSON only.
  const repairRaw = await callLLM(
    [
      {
        role: "system",
        content:
          "Convert the user content into valid JSON only. No prose, no markdown, no code fences.",
      },
      { role: "user", content: raw },
    ],
    { model, temperature: 0, stream: false, format: INTERVIEW_JSON_SCHEMA }
  );

  try {
    const repaired = parseInterviewJson(repairRaw);
    if (isValidInterviewPayload(repaired)) {
      return repaired;
    }
  } catch {
    // Continue to regeneration fallback.
  }

  // Final retry: regenerate from source with hard constraints to avoid empty JSON objects.
  const strictSystemPrompt =
    "Return exactly one JSON object with keys summary, questions, hands_on_task, follow_ups. Never return {}.";
  const strictRaw = await callLLM(
    [
      { role: "system", content: strictSystemPrompt },
      { role: "user", content: userPrompt },
    ],
    { model, temperature: 0, stream: false, format: INTERVIEW_JSON_SCHEMA }
  );

  try {
    const strictParsed = parseInterviewJson(strictRaw);
    if (isValidInterviewPayload(strictParsed)) {
      return strictParsed;
    }
  } catch {
    // Fall through to detailed error.
  }

  return {
    error: "invalid_interview_payload",
    raw,
    repairRaw,
    strictRaw,
  };
}

module.exports = {
  callLLM,
  generateInterviewFromCode,
};