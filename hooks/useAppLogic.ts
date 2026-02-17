
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GithubConfig, BuildStep, User as UserType, ProjectConfig, Project, WorkspaceType } from '../types';
import { GeminiService } from '../services/geminiService';
import { DatabaseService, ProjectHistoryItem } from '../services/dbService';
import { GithubService } from '../services/githubService';
import { SelfHealingService } from '../services/selfHealingService';
import { applyDiffs } from '../utils/diffUtils';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'healing';
}

export const useAppLogic = (user: UserType | null, setUser: (u: UserType | null) => void) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(localStorage.getItem('active_project_id'));
  const [workspace, setWorkspace] = useState<WorkspaceType>('app');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState(false);
  const [runtimeError, setRuntimeError] = useState<{ message: string; line: number; source: string; stack?: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [lastThought, setLastThought] = useState<string>('');
  const [currentPlan, setCurrentPlan] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [executionQueue, setExecutionQueue] = useState<string[]>([]);
  
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({
    'app/index.html': `
      <div class="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-white p-8 overflow-hidden relative">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.1)_0%,_transparent_70%)]"></div>
        <div class="relative z-10 flex flex-col items-center gap-12 animate-in zoom-in duration-1000">
          <div class="w-24 h-24 bg-pink-600/10 rounded-[2.5rem] border border-pink-500/20 flex items-center justify-center shadow-[0_0_60px_rgba(236,72,153,0.2)] animate-bounce">
             <svg class="w-12 h-12 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M12 3l1.912 5.886h6.191l-5.008 3.638 1.912 5.886-5.007-3.638-5.007 3.638 1.912-5.886-5.008-3.638h6.191z"></path>
             </svg>
          </div>
          <div class="text-center space-y-4">
            <h1 class="text-4xl font-black tracking-tighter uppercase leading-tight">
              OneClick <span class="text-pink-500">Studio</span>
            </h1>
            <p class="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-600">Autonomous Node Active</p>
          </div>
        </div>
      </div>
    `
  });
  
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({ appName: 'OneClickApp', packageName: 'com.oneclick.studio' });
  const [selectedFile, setSelectedFile] = useState('app/index.html');
  const [openTabs, setOpenTabs] = useState<string[]>(['app/index.html']);
  const [githubConfig, setGithubConfig] = useState<GithubConfig>({ token: '', repo: '', owner: '' });
  const [history, setHistory] = useState<ProjectHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<Record<string, string> | null>(null);

  const gemini = useRef(new GeminiService());
  const db = DatabaseService.getInstance();
  const github = useRef(new GithubService());
  const healer = useRef(new SelfHealingService());

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleSend = async (extraData?: string, isAuto: boolean = false) => {
    if (isGenerating && !isAuto) return;
    setIsGenerating(true);
    if (!isAuto) setCurrentPlan([]); 

    try {
      let text = extraData || input;
      
      // Smart Batch Processing Logic
      const listPattern = /^(\s*[-*•]|\s*\d+\.)\s+.+/gm;
      const matches = text.match(listPattern);
      
      if (!isAuto && matches && matches.length > 1) {
        const tasks = matches.map(t => t.trim());
        const [firstTask, ...remainingTasks] = tasks;
        
        setExecutionQueue(remainingTasks);
        addToast(`Roadmap Initiated: 1 executing, ${remainingTasks.length} queued`, 'info');
        
        text = `[BATCH PROCESS START]
        User Selected Roadmap:
        ${tasks.join('\n')}
        
        CURRENT GOAL: Execute ONLY the first task: "${firstTask.replace(/^[-*•\d.]+\s*/, '')}".
        Do not implement other tasks yet. Maintain code integrity.`;
      }

      const userMessage = { id: Date.now().toString(), role: 'user', content: text, image: selectedImage?.preview };
      setMessages(prev => [...prev, userMessage]);
      
      if (!isAuto) {
          setInput(''); 
          setSelectedImage(null);
      }

      const res = await gemini.current.generateWebsite(text, projectFiles, messages, selectedImage ? { data: selectedImage.data, mimeType: selectedImage.mimeType } : undefined, user ? user.tokens > 100 : false, projectConfig);
      
      if (res.thought) setLastThought(res.thought);
      if (res.plan) setCurrentPlan(res.plan);
      
      setProjectFiles(prev => {
        let newFiles = { ...prev };
        
        if (res.files) {
          newFiles = { ...newFiles, ...res.files };
        }
        
        if (res.diffs) {
          Object.entries(res.diffs).forEach(([path, diffBlocks]) => {
            const original = newFiles[path] || "";
            newFiles[path] = applyDiffs(original, diffBlocks as any);
          });
          if (!isAuto) addToast("Optimized Patch Applied", "success");
        }
        
        return newFiles;
      });
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.answer, 
        questions: res.questions, 
        files: res.files, 
        diffs: res.diffs, 
        plan: res.plan 
      }]);
      
      if ((res.files || res.diffs) && currentProjectId) {
         db.createProjectSnapshot(currentProjectId, projectFiles, res.summary || (isAuto ? "Auto-Task Complete" : "Smart Update")).then(() => loadHistory(currentProjectId));
      }
    } catch (err: any) {
      addToast(err.message, "error");
      setExecutionQueue([]); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  useEffect(() => {
    if (!isGenerating && executionQueue.length > 0) {
      const nextTask = executionQueue[0];
      const remaining = executionQueue.slice(1);
      
      const timer = setTimeout(() => {
        setExecutionQueue(remaining);
        const cleanTaskName = nextTask.replace(/^[-*•\d.]+\s*/, '');
        addToast(`Auto-Executing: ${cleanTaskName}`, 'healing');
        
        handleSend(`[AUTO-CONTINUE] Previous task complete. 
        
        NEXT GOAL: Execute task: "${cleanTaskName}".
        Ensure it integrates with existing code.`, true);
      }, 1500); 

      return () => clearTimeout(timer);
    }
  }, [isGenerating, executionQueue]);

  useEffect(() => {
    if (user && currentProjectId) {
      db.getProjectById(currentProjectId).then(p => {
        if (p) {
          setProjectFiles(p.files || {});
          if (p.config) setProjectConfig(p.config);
          loadHistory(currentProjectId);
        }
      });
    }
  }, [user, currentProjectId]);

  const loadHistory = async (projectId: string) => {
    setIsHistoryLoading(true);
    try { setHistory(await db.getProjectHistory(projectId)); } finally { setIsHistoryLoading(false); }
  };

  return {
    messages, setMessages, input, setInput, isGenerating, isRepairing, projectFiles, setProjectFiles,
    workspace, setWorkspace, mobileTab, setMobileTab, currentPlan,
    selectedFile, setSelectedFile, openTabs, openFile: (path: string) => { if (!openTabs.includes(path)) setOpenTabs(prev => [...prev, path]); setSelectedFile(path); },
    closeFile: (path: string) => { setOpenTabs(prev => prev.filter(t => t !== path)); if (selectedFile === path) setSelectedFile(openTabs[0] || ''); },
    addFile: (path: string) => { setProjectFiles(prev => ({...prev, [path]: ''})); }, deleteFile: (path: string) => { const n = {...projectFiles}; delete n[path]; setProjectFiles(n); }, renameFile: (o:string, n:string) => { const x = {...projectFiles}; x[n] = x[o]; delete x[o]; setProjectFiles(x); },
    githubConfig, setGithubConfig, buildStatus: { status: 'idle', message: '' }, setBuildStatus: () => {}, buildSteps: [], isDownloading: false, handleSend, handleBuildAPK: async () => {},
    handleSecureDownload: async () => {}, selectedImage, setSelectedImage, handleImageSelect: (file: File) => {}, 
    projectConfig, setProjectConfig, currentProjectId, loadProject: (p:Project) => { setCurrentProjectId(p.id); localStorage.setItem('active_project_id', p.id); setProjectFiles(p.files); if(p.config) setProjectConfig(p.config); loadHistory(p.id); },
    runtimeError, handleAutoFix: async () => {}, history, isHistoryLoading, showHistory, setShowHistory, handleRollback: async (f:any, m:string) => { setProjectFiles(f); setShowHistory(false); }, previewOverride, setPreviewOverride, refreshHistory: () => loadHistory(currentProjectId!), handleDeleteSnapshot: async (id:string) => { await db.deleteProjectSnapshot(id); loadHistory(currentProjectId!); }, lastThought,
    toasts, removeToast, repairSuccess, executionQueue
  };
};
