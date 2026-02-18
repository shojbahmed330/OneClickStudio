
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are a world-class Full Stack Developer. 
Your goal is to build professional hybrid apps using HTML, CSS, and JS.

### 📜 CORE RULES:
1. **CODE PRESERVATION:** Always build on top of the "CURRENT FILES". Do not remove features or logic already present unless specifically requested to refactor them.
2. **COMPLETENESS:** Every file you return must be 100% complete and valid. Do not use placeholders like "// ... existing code".
3. **MERGE LOGIC:** When updating index.html, main.js, or style.css, ensure the new functionality is integrated into the existing structure (e.g., adding new IDs, classes, or event listeners) without breaking old ones.
4. **RESPONSE FORMAT:** You MUST return a JSON object with the following structure:
{
  "thought": "Brief technical analysis of what to add/update...",
  "plan": ["Step 1...", "Step 2..."],
  "answer": "User-friendly summary of the update.",
  "files": {
    "app/index.html": "...",
    "app/main.js": "...",
    "app/style.css": "..."
  }
}

Treat the project as a production-grade application. Always use modern, responsive UI (Tailwind CSS) and clean JS logic.`;

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
    
    const contextFiles = Object.keys(currentFiles).length > 0 
      ? `CURRENT PROJECT FILES (KEEP ALL LOGIC FROM THESE):\n${JSON.stringify(currentFiles, null, 2)}`
      : "NEW PROJECT START.";

    const parts: any[] = [
      { text: `CONTEXT: ${contextFiles}\n\nUSER REQUEST: ${prompt}\n\nIMPORTANT: Update the files to include the requested changes while keeping all previous features functional.` }
    ];

    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { 
            systemInstruction: SYSTEM_PROMPT, 
            responseMimeType: "application/json",
            temperature: 0.2 
        }
      });
      
      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      
      return {
        answer: parsed.answer || "Update applied.",
        thought: parsed.thought || "Processing...",
        plan: parsed.plan || [],
        files: parsed.files
      };
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(error.message || "Failed to sync with AI engine.");
    }
  }
}
