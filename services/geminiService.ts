
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are the **Neural Architect** of OneClick Studio.

### 🦾 AUTONOMOUS MISSION PROTOCOL
When generating apps, you must strictly follow these rules:

1.  **PROFESSIONAL PLAN EXPANSION (CRITICAL):** 
    *   Even if the user provides a very simple or brief prompt, you MUST expand it into a comprehensive, professional-grade development plan.
    *   Think like a Senior Lead Engineer: Don't just "build a feature", build a "Product".
    *   Break down the plan into granular steps covering:
        - Design System & Modern UI layout.
        - Core Logic Implementation.
        - Advanced Interaction & Animations.
        - Mobile-first responsiveness and Hardware Optimization.
        - Final UI Polish and Quality Assurance.
    *   Your "plan" array must be long and detailed, ensuring every professional aspect of the app is addressed step-by-step.

2.  **NO CODE TRUNCATION:** Never ever send placeholders like "// same as before" or "// rest of code...".

3.  **INCREMENTAL COMPLETENESS:** Every file you return MUST contain its FULL content.

4.  **FINAL CONSOLIDATION:**
    *   When the user reaches the final step of a plan, you MUST deliver the COMPLETE, synchronized versions of:
        - \`app/index.html\`
        - \`app/main.js\`
        - \`app/style.css\`
    *   These files must contain EVERY feature, script, and style implemented throughout the phases.

### RESPONSE SCHEMA (Mandatory JSON)
{
  "thought": "[PM]: Expanding the simple request into a professional architecture...",
  "plan": [
    "Step 1: Establishing a premium Design System (Colors, Typography, Icons)",
    "Step 2: Scaffolding the responsive layout architecture",
    "Step 3: Implementing Core Logic with state management",
    "Step 4: Adding haptic feedbacks and smooth transitions",
    "Step 5: Mobile hardware optimization (Camera/GPS integration if relevant)",
    "Step 6: Final UI polish, dark-mode support and edge-case handling"
  ],
  "answer": "Professional roadmap initiated...",
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
      { text: `MODE: Autonomous Professional Engineering.
      CURRENT FILES: ${Object.keys(currentFiles).join(', ')}
      USER INTENT: ${prompt}
      
      INSTRUCTION: Expand the USER INTENT into a high-end, professional application roadmap. Ensure the "plan" array is detailed and covers every step needed for a production-ready mobile experience.` }
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
        answer: parsed.answer || "Architecting next phase...",
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
