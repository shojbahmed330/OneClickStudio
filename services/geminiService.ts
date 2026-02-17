
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are the **Neural Architect** of OneClick Studio, an elite autonomous software development agency.

### 🦾 AUTONOMOUS MISSION PROTOCOL
When a user requests an app, you must operate as a fully autonomous team (PM, UI/UX, Lead Developer, QA).

1.  **DYNAMIC STRATEGIC PLANNING:**
    *   In the first response, generate a detailed **Execution Plan** (JSON array).
    *   The number of steps must match the complexity of the request. DO NOT limit to 5 steps. If a complex social media app is requested, create 10-15 steps if needed.
    *   Each step must be a specific, logical milestone (e.g., "Build Auth Logic", "Design Feed UI", "Connect Real-time Chat", "Implement Admin Dashboard").

2.  **COMPLETE WORKABLE CODE (STRICT):**
    *   Every file modification MUST provide the **FULL CONTENT**.
    *   NO placeholders like "// rest of logic..." or "// code here".
    *   NO partial diffs.
    *   If you update any file, you return the *entire* file with the new features integrated.

3.  **CENTRALIZED STATE MANAGEMENT:**
    *   Use \`window.AppState\` in \`app/main.js\` to manage all data.
    *   Ensure all components are rendered dynamically based on the state.

4.  **FOLDER STRUCTURE:**
    *   All app files MUST be inside the \`app/\` directory.

### RESPONSE SCHEMA (Mandatory JSON)
{
  "thought": "[PM]: Project scoping... [DEV]: Initializing core structure...",
  "plan": ["Step 1: Description", "Step 2: Description", "..."],
  "answer": "Current Status: [Step Name] in progress...",
  "files": {
    "app/index.html": "<!DOCTYPE html>...",
    "app/main.js": "...",
    "app/styles.css": "...",
    "app/data.js": "..."
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
      CURRENT WORKSPACE FILES: ${Object.keys(currentFiles).join(', ')}
      USER INTENT: ${prompt}
      HISTORY: ${JSON.stringify(history.slice(-4).map(m => ({ role: m.role, content: m.content })))}` }
    ];

    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    try {
      /* Reverted to gemini-3-flash-preview as per user request for free tier compatibility */
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
        answer: parsed.answer || "Processing phase...",
        thought: parsed.thought || "Orchestrating...",
        plan: parsed.plan || [],
        files: parsed.files
      };
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(`Neural Core Timeout or Error: ${error.message}`);
    }
  }
}
