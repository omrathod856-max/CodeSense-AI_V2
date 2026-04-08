const { extractCodeFromRepo } = require("./utils/repomix");
const { generateInterviewFromCode } = require("./utils/llm");

async function main() {
  const repoUrl = process.argv[2];
  if (!repoUrl) {
    throw new Error("Usage: node generation.js <github-repo-url>");
  }

  const repoContext = await extractCodeFromRepo(repoUrl);

  const code =
    typeof repoContext === "string"
      ? repoContext
      : (repoContext && repoContext.code) || "";

  if (repoContext && typeof repoContext === "object") {
    console.log(
      `[repomix] original=${repoContext.originalLength}, final=${repoContext.finalLength}, truncated=${repoContext.truncated}`
    );
  }

  if (!code.trim()) {
    throw new Error("Repomix returned empty context.");
  }

  const interview = await generateInterviewFromCode({
    code, // pass string directly
    language: "mixed",
    role: "Software Engineer",
    difficulty: "medium",
    focusAreas: ["problem solving", "code quality", "debugging"],
  });

  console.log(JSON.stringify(interview, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});