import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY in the .env file");
}

export const aiClient = new Anthropic({
  apiKey,
  maxRetries: 0,
  timeout: 30_000,
});
