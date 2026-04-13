const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "https://osteoblastic-hyperfine-keira.ngrok-free.dev";
const OLLAMA_CHAT_PATH = process.env.OLLAMA_CHAT_PATH || "/api/chat";
const OLLAMA_FALLBACK_BASE_URL = process.env.OLLAMA_FALLBACK_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const LLM_PROMPT_MAX_CODE_CHARS = Number(process.env.LLM_PROMPT_MAX_CODE_CHARS || 30000);
const OLLAMA_AUTH_TOKEN = process.env.OLLAMA_AUTH_TOKEN || "";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const INTERVIEW_MIN_QUESTIONS = Number(process.env.INTERVIEW_MIN_QUESTIONS || 8);
const INTERVIEW_TARGET_QUESTIONS = Number(process.env.INTERVIEW_TARGET_QUESTIONS || 10);
const INTERVIEW_MIN_FOLLOWUPS = Number(process.env.INTERVIEW_MIN_FOLLOWUPS || 5);
const INTERVIEW_MAX_ATTEMPTS = Math.max(1, Number(process.env.INTERVIEW_MAX_ATTEMPTS || 2));
const INTERVIEW_ENABLE_STRICT_RETRY = process.env.INTERVIEW_ENABLE_STRICT_RETRY === "true";

const INTERVIEW_JSON_SCHEMA = {
  type: "object",
  required: ["summary", "questions", "hands_on_task", "follow_ups"],
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1 },
    questions: {
      type: "array",
      minItems: INTERVIEW_MIN_QUESTIONS,
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
      minItems: INTERVIEW_MIN_FOLLOWUPS,
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
    // ngrok free tier may block non-browser requests unless this header is present.
    "ngrok-skip-browser-warning": "true",
    ...extraHeaders,
  };

  if (OLLAMA_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${OLLAMA_AUTH_TOKEN}`;
  }

  if (OLLAMA_API_KEY && !headers.Authorization) {
    headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  }

  return headers;
}

function parseChatContent(data) {
  // Ollama-style response: { message: { content: "..." } }
  if (data?.message?.content) {
    return data.message.content;
  }

  // OpenAI-compatible response: { choices: [{ message: { content: "..." } }] }
  const openAiContent = data?.choices?.[0]?.message?.content;
  if (typeof openAiContent === "string" && openAiContent.trim()) {
    return openAiContent;
  }

  // Some providers return a plain text field.
  if (typeof data?.response === "string" && data.response.trim()) {
    return data.response;
  }

  return "";
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
  const content = parseChatContent(data);
  if (!content) {
    throw new Error(
      `Invalid chat response at ${chatUrl}: missing text content in message/choices/response.`
    );
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
  const isOpenAiCompatible = /\/v1\/chat\/completions$/i.test(chatUrl);
  const payload = {
    model,
    messages,
    stream,
    ...(isOpenAiCompatible ? { temperature } : {}),
    ...(isOpenAiCompatible ? {} : { options: { temperature } }),
    ...(!isOpenAiCompatible && format ? { format } : {}),
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
  const hasQuestions =
    Array.isArray(payload.questions) && payload.questions.length >= INTERVIEW_MIN_QUESTIONS;
  const hasHandsOnTask =
    payload.hands_on_task &&
    typeof payload.hands_on_task === "object" &&
    typeof payload.hands_on_task.prompt === "string" &&
    payload.hands_on_task.prompt.trim().length > 0;
  const hasFollowUps =
    Array.isArray(payload.follow_ups) && payload.follow_ups.length >= INTERVIEW_MIN_FOLLOWUPS;

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
    "Convert the given source code into a practical, structured interview kit.",
    "",
    "Structure requirements (must follow):",
    `- Generate exactly ${INTERVIEW_TARGET_QUESTIONS} questions.`,
    "- Questions must be practical and code-grounded (not generic textbook prompts).",
    "- Cover all question types: conceptual, code-reading, debugging, design.",
    "- Use progressive difficulty: easy -> medium -> hard.",
    "- Every question must have at least 2 specific expected points tied to this codebase.",
    `- Generate at least ${INTERVIEW_MIN_FOLLOWUPS} follow-up questions focused on tradeoffs and edge cases.`,
    "- The hands_on_task prompt should be implementable in 30-45 minutes.",
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

  let repairRaw;
  let strictRaw;

  if (INTERVIEW_MAX_ATTEMPTS >= 2) {
    // Fast retry: ask model to transform previous output into strict JSON only.
    repairRaw = await callLLM(
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
      // Continue to optional strict regeneration.
    }
  }

  if (INTERVIEW_ENABLE_STRICT_RETRY && INTERVIEW_MAX_ATTEMPTS >= 3) {
    // Optional strict retry: slower, but can recover difficult outputs.
    const strictSystemPrompt =
      `Return exactly one JSON object with keys summary, questions, hands_on_task, follow_ups. Never return {}. Include at least ${INTERVIEW_MIN_QUESTIONS} questions and at least ${INTERVIEW_MIN_FOLLOWUPS} follow_ups.`;
    strictRaw = await callLLM(
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