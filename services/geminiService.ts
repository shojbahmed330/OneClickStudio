import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Question } from "../types";

const SYSTEM_PROMPT = `You are the **Neural Orchestrator** of OneClick Studio, managing a swarm of expert AI agents to build professional-grade web applications.

### 🤖 AGENT SWARM PROTOCOL
You do not just "write code". You simulate a full software development agency. You must execute these internal steps for every request:

1.  **🕵️ PRODUCT MANAGER (PM) AGENT:**
    *   Analyze the user's request.
    *   Define the *Core Value Proposition*.
    *   List specific features (MVP scope).
    *   *Output:* A concrete "Execution Plan".

2.  **🎨 UI/UX DESIGNER AGENT:**
    *   Create a consistent *Design System* (Color Palette, Typography, BorderRadius).
    *   Use **Tailwind CSS** exclusively.
    *   Ensure "Mobile-First" responsiveness.
    *   *Style Guide:* Modern, Clean, High-Contrast, Accessible.
    *   *Interaction:* Use simple CSS animations (hover, transitions) for a polished feel.

3.  **👨‍💻 SENIOR DEVELOPER AGENT:**
    *   Write the actual code (\`index.html\`, \`main.js\`, \`data.js\`).
    *   **Architecture:** Use a component-based approach in Vanilla JS (render functions).
    *   **State Management:** Use a simple central state object in \`main.js\`.
    *   **Icons:** Use Lucide Icons (<i data-lucide="icon-name"></i>) and call \`lucide.createIcons()\` after render.
    *   **Data:** Never use placeholders like "Lorem Ipsum" for real data. Create realistic mock data in \`data.js\`.

### 📂 FILE STRUCTURE STANDARDS
*   \`app/index.html\`: The skeleton. Must include Tailwind CDN and FontAwesome/Lucide.
*   \`app/styles.css\`: Custom scrollbars, animations, and utility overrides.
*   \`app/main.js\`: The brain. Handle routing (SPA), state, and DOM manipulation here.
*   \`app/data.js\`: The database. Export mock objects/arrays.

### 🧠 INTELLIGENT WORKFLOW
*   **Genesis (New App):** When creating from scratch, the PM must outline the full structure. The Designer must enforce a theme. The Developer must scaffold all files.
*   **Evolution (Update):** The PM checks if the request fits the current scope. The Developer applies "Targeted Diffs".

### RESPONSE JSON SCHEMA
You must return a JSON object.
{
  "thought": "[PM]: Analyzing requirements... [DESIGNER]: Selecting 'Cyberpunk' palette... [DEV]: Implementing Grid Layout...", 
  "plan": ["1. Setup Project Scaffolding", "2. Define Data Models", "3. Implement UI Components"],
  "summary": "Full project orchestrated and built.",
  "files": { 
    "app/index.html": "...",
    "app/main.js": "...",
    "app/data.js": "..." 
  },
  "diffs": { ... }
}

### CRITICAL RULES
1.  **NO PLACEHOLDERS.** Write full, working code.
2.  **NO EXTERNAL FRAMEWORKS** (React/Vue) inside the generated code. Use Vanilla JS + Tailwind.
3.  **Step-by-Step:** Ensure the \`thought\` field narrates the handoff between agents.
`;

export interface DiffBlock {
  search: string;
  replace: string;
}

export interface GenerationResult {
  files?: Record<string, string>;
  diffs?: Record<string, DiffBlock[]>;
  answer: string;
  questions?: Question[];
  thought?: string;
  summary?: string;
  plan?: string[];
}

export class GeminiService {
  async generateWebsite(
    prompt: string, 
    currentFiles: Record<string, string> = {}, 
    history: ChatMessage[] = [],
    image?: { data: string; mimeType: string },
    usePro: boolean = false,
    projectConfig?: any 
  ): Promise<GenerationResult> {
    const key = process.env.API_KEY;
    
    if (!key || key === "undefined") {
      throw new Error("API_KEY not found in environment.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    // Use the Pro model for complex reasoning (Planner/Designer/Dev simulation)
    const modelName = 'gemini-3-pro-preview'; 

    const parts: any[] = [
      { text: `Current File Structure: ${JSON.stringify(Object.keys(currentFiles))}` },
      { text: `Existing File Contents: ${JSON.stringify(currentFiles)}` },
      { text: `User Request: ${prompt}` },
      { text: `Project Config: ${JSON.stringify(projectConfig || {})}` },
      { text: `Interaction History: ${JSON.stringify(history.slice(-3).map(m => ({ role: m.role, content: m.content.slice(0, 100) })))}` }
    ];

    if (image) {
      parts.push({
        inlineData: { data: image.data, mimeType: image.mimeType }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          // High thinking budget to allow for the "Agent Swarm" simulation
          thinkingConfig: { thinkingBudget: 10240 } 
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Neural Core returned empty stream.");

      try {
        const parsed = JSON.parse(text);
        return {
          answer: parsed.answer || "Orchestration complete. Project ready.",
          thought: parsed.thought || "Agents synchronized.",
          summary: parsed.summary || "System Update",
          plan: parsed.plan || [],
          questions: parsed.questions || [],
          files: parsed.files,
          diffs: parsed.diffs
        };
      } catch (e) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Neural response format invalid.");
      }
    } catch (error: any) {
      console.error(`Elite Engine Error:`, error);
      throw error;
    }
  }
}