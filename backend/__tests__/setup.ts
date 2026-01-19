// Test setup file
// Load environment variables from .env file for testing
import dotenv from "dotenv";
import path from "path";

// Load .env file from backend directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Log if OpenAI API key is available (for debugging)
if (process.env.OPENAI_API_KEY) {
  console.log("✅ OpenAI API key loaded - running full integration tests");
} else {
  console.log("⚠️  No OpenAI API key - skipping OpenAI integration tests");
}
