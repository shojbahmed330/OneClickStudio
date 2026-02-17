
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are the **Neural Architect** of OneClick Studio.

### 🦾 AUTONOMOUS MISSION PROTOCOL
When generating apps, you must strictly follow these rules:

1.  **NO CODE TRUNCATION:** Never ever send placeholders like "// same as before" or "// rest of code...".
2.  **INCREMENTAL COMPLETENESS:** Every file you return MUST contain its FULL content.
3.  **FINAL CONSOLIDATION (CRITICAL):**
    *   When the user reaches the final step of a plan, you MUST deliver the COMPLETE, synchronized versions of:
        - \`app/index.html\`
        - \`app/main.js\`
        - \`app/style.css\`
    *   These files must contain EVERY feature, script, and style implemented throughout the phases.
4.  **ERROR PREVENTION:** Do not return empty files or text summaries in the 'files' object at the end of the process.

### RESPONSE SCHEMA (Mandatory JSON)
{
  "thought": "[PM]: Project logic...",
  "plan": ["Phase 1", "Phase 2", "..."],
  "answer": "Status update...",
  "files": {
    "app/index.html": "<!DOCTYPE html>...",
    "app/main.js": "...",
    "app/style.css": "..."
  }
}
`;

export interface GenerationResult {
  files?: Record<string, string>;
  answer: string;
  thought?: string;
  plan?: string[];
}

export class GeminiService {
  async generateWebsite(
    prompt: string, 
    currentFiles: Record<string, string> = {}, 
    history: ChatMessage[] = [],
    image?: { data: string; mimeType: string },
    projectConfig?: any 
  ): Promise<GenerationResult> {
    const key = process.env.API_KEY;
    if (!key || key === "undefined") throw new Error("API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    
    const parts: any[] = [
      { text: `MODE: Autonomous Engineering.
      CURRENT WORKSPACE: ${Object.keys(currentFiles).join(', ')}
      USER INTENT: ${prompt}` }
    ];

    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { 
            systemInstruction: SYSTEM_PROMPT, 
            responseMimeType: "application/json",
            temperature: 0.1 
        }
      });
      
      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      
      return {
        answer: parsed.answer || "Process complete.",
        thought: parsed.thought || "Orchestrating...",
        plan: parsed.plan || [],
        files: parsed.files
      };
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(error.message || "Neural Core Interrupted.");
    }
  }
}
