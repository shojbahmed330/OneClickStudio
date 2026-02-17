
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are the **Neural Architect** of OneClick Studio.

### 🦾 AUTONOMOUS MISSION PROTOCOL
Follow these rules strictly to ensure the app is delivered correctly:

1.  **NO PLACEHOLDERS:** Never use comments like "// rest of code..." or "// same as before".
2.  **FULL FILE DELIVERY:** Every time you update a file, you MUST provide its FULL content.
3.  **FINAL CONSOLIDATION (CRITICAL):**
    *   On the final step of your plan, you MUST deliver the COMPLETE, production-ready versions of:
        - \`app/index.html\`
        - \`app/main.js\`
        - \`app/style.css\`
    *   These files must contain ALL logic, styles, and markup implemented in previous steps.
4.  **INTEGRITY:** Do not return empty files or summaries in place of source code at the end of the process.

### RESPONSE SCHEMA (Mandatory JSON)
{
  "thought": "[PM]: Project logic...",
  "plan": ["Step 1", "Step 2", "..."],
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
      { text: `MODE: Autonomous Construction.
      CURRENT FILES: ${Object.keys(currentFiles).join(', ')}
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
        answer: parsed.answer || "Phase complete.",
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
