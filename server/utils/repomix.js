// import { runCli } from 'repomix';
// import fs from 'fs/promises';
// import path from 'path';

const { runCli } = require('repomix');
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_MAX_CONTEXT_CHARS = Number(process.env.REPOMIX_MAX_CONTEXT_CHARS || 120000);

function clampContext(repoContext, maxChars = DEFAULT_MAX_CONTEXT_CHARS) {
  if (typeof repoContext !== 'string') return '';
  if (repoContext.length <= maxChars) return repoContext;
  return `${repoContext.slice(0, maxChars)}\n\n<!-- Context truncated to ${maxChars} chars for model limits -->`;
}

function stripNonCodeFilesFromXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return '';

  // Remove full <file> blocks for common non-code assets even if upstream ignore misses them.
  return xml.replace(
    /<file\s+path="[^"]+\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|mp4|mp3|lock)"[^>]*>[\s\S]*?<\/file>/gi,
    ''
  );
}

/**
 * Controller to extract GitHub repo and prepare it for an LLM
 */
const extractCodeFromRepo = async (repoUrl) => {
  try {
    // 1. Define configuration for the extraction
    const options = {
      remote: repoUrl,          // The GitHub URL or "user/repo"
      style: 'xml',             // Best format for LLM parsing
      output: 'temp_repo.xml',  // Temporary file name
      compress: true,           // Removes fluff to save tokens
      removeComments: true,     // Keeps only logic for cleaner interview questions
      ignore: [
        '**/*.svg',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.webp',
        '**/*.ico',
        '**/*.pdf',
        '**/*.mp4',
        '**/*.mp3',
        '**/*.lock',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/node_modules/**',
      ],
    };

    // 2. Run Repomix programmatically
    // ['.'] tells it to process the root of the cloned repo
    await runCli(['.'], process.cwd(), options);

    // 3. Read the generated output
    const outputPath = path.join(process.cwd(), 'temp_repo.xml');
    const repoContext = await fs.readFile(outputPath, 'utf-8');

    // 4. Cleanup: Delete the temp file after reading into memory
    await fs.unlink(outputPath);

    const filteredContext = stripNonCodeFilesFromXml(repoContext);
    const safeContext = clampContext(filteredContext);

    return {
      code: safeContext,
      originalLength: repoContext.length,
      finalLength: safeContext.length,
      truncated: safeContext.length < repoContext.length,
    };

  } catch (error) {
    console.error("Extraction failed:", error);
    throw new Error("Could not extract repository context.");
  }
};

module.exports = { extractCodeFromRepo };