
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as UserType, ProjectConfig, Project, WorkspaceType, BuildStep, GithubConfig } from '../types';
import { GeminiService } from '../services/geminiService';
import { DatabaseService } from '../services/dbService';

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
  const [executionQueue, setExecutionQueue] = useState<string[]>([]);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({ appName: 'OneClickApp', packageName: 'com.oneclick.studio' });
  const [selectedFile, setSelectedFile] = useState('app/index.html');
  const [openTabs, setOpenTabs] = useState<string[]>(['app/index.html']);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastThought, setLastThought] = useState<string>('');
  const [currentPlan, setCurrentPlan] = useState<string[]>([]);

  const [buildStatus, setBuildStatus] = useState({ status: 'idle', message: '' });
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<Record<string, string> | null>(null);
  const [githubConfig, setGithubConfig] = useState<GithubConfig>({ 
    token: user?.github_token || '', 
    owner: user?.github_owner || '', 
    repo: user?.github_repo || '' 
  });

  const gemini = useRef(new GeminiService());
  const db = DatabaseService.getInstance();

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleSend = async (customPrompt?: string, isAuto: boolean = false) => {
    if (isGenerating && !isAuto) return;
    setIsGenerating(true);

    try {
      const promptText = customPrompt || input;
      const currentImage = selectedImage ? { data: selectedImage.data, mimeType: selectedImage.mimeType } : undefined;

      if (!isAuto) {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(),
          role: 'user', 
          content: promptText, 
          image: selectedImage?.preview,
          timestamp: Date.now() 
        }]);
        setInput('');
        setSelectedImage(null);
      }

      const res = await gemini.current.generateWebsite(promptText, projectFiles, messages, currentImage, projectConfig);
      
      if (res.thought) setLastThought(res.thought);
      
      if (res.files) {
        const updatedFiles = { ...projectFiles };
        let integrityBreached = false;

        Object.entries(res.files).forEach(([path, newContent]) => {
            const oldContent = projectFiles[path] || "";
            // Protection logic: If AI tries to replace a long file with a tiny placeholder during automation
            if (isAuto && oldContent.length > 500 && (newContent as string).length < 100) {
                console.warn(`Integrity Guard: Blocked potential code clearing for ${path}`);
                integrityBreached = true;
                return;
            }
            updatedFiles[path] = newContent as string;
        });

        // Only commit changes if no suspicious truncation was detected in auto-mode
        if (!integrityBreached || !isAuto) {
            setProjectFiles(updatedFiles);
        }
      }

      if (res.plan && res.plan.length > 0 && !isAuto) {
        setCurrentPlan(res.plan);
        setExecutionQueue(res.plan.slice(1));
        addToast(`Engineering Strategy Locked: ${res.plan.length} steps.`, 'success');
      }

      const statusPrefix = isAuto ? `[DONE] ` : ``;
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(),
        role: 'assistant', 
        content: statusPrefix + res.answer, 
        plan: res.plan || (isAuto ? currentPlan : []),
        timestamp: Date.now() 
      }]);

      if (currentProjectId && user) {
        await db.updateProject(user.id, currentProjectId, projectFiles, projectConfig);
      }

    } catch (err: any) {
      addToast(err.message, 'error');
      setExecutionQueue([]); 
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!isGenerating && executionQueue.length > 0) {
      const nextTask = executionQueue[0];
      const timer = setTimeout(() => {
        setExecutionQueue(prev => prev.slice(1));
        
        const totalSteps = currentPlan.length;
        const stepNum = totalSteps - executionQueue.length + 1;
        const isFinalStep = executionQueue.length === 1;
        
        addToast(`Phase ${stepNum}/${totalSteps}: ${nextTask.slice(0, 30)}...`, 'info');

        const internalCommand = `[AUTONOMOUS ENGINE STATUS]
        PHASE: ${stepNum} of ${totalSteps}
        TASK: ${nextTask}
        
        ${isFinalStep ? `CRITICAL SECURITY INSTRUCTION: This is the FINAL step.
        You MUST deliver the COMPLETE, FULL source code for the entire app.
        REQUIRED FILES (with FULL content): 'app/index.html', 'app/main.js', and 'app/style.css'.
        Do NOT send placeholders or summaries. Consolidate everything into these final production files.` : 'INSTRUCTION: Implement full code for this task.'}
        
        Update necessary files. Return FULL content of every file.`;
        
        handleSend(internalCommand, true);
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [isGenerating, executionQueue, currentPlan, messages, projectFiles]);

  const handleImageSelect = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedImage({
        data: base64.split(',')[1],
        mimeType: file.type,
        preview: base64
      });
    };
    reader.readAsDataURL(file);
  };

  const loadProject = (project: Project) => {
    setCurrentProjectId(project.id);
    localStorage.setItem('active_project_id', project.id);
    setProjectFiles(project.files);
    if (project.config) setProjectConfig(project.config);
  };

  const handleRollback = async (files: Record<string, string>, message: string) => {
    setProjectFiles(files);
    addToast(`Restored to: ${message}`, 'success');
    setPreviewOverride(null);
  };

  const handleBuildAPK = async (onConfigRequired: () => void) => {
    if (!githubConfig.token || !githubConfig.owner) {
      addToast("GitHub Configuration Required.", "error");
      onConfigRequired();
      return;
    }
    setBuildStatus({ status: 'pushing', message: 'Uplinking to GitHub...' });
    setBuildSteps([{ name: 'Security Check', status: 'completed', conclusion: 'success' }]);
  };

  const handleSecureDownload = () => {
    addToast("Preparing Download Bundle...", "info");
  };

  const addFile = (path: string) => {
    setProjectFiles(prev => ({ ...prev, [path]: '' }));
    openFile(path);
  };

  const deleteFile = (path: string) => {
    setProjectFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setOpenTabs(prev => prev.filter(t => t !== path));
  };

  const renameFile = (oldPath: string, newPath: string) => {
    setProjectFiles(prev => {
      const next = { ...prev };
      next[newPath] = next[oldPath];
      delete next[oldPath];
      return next;
    });
    setOpenTabs(prev => prev.map(t => t === oldPath ? newPath : t));
  };

  const openFile = (path: string) => {
    setSelectedFile(path);
    if (!openTabs.includes(path)) setOpenTabs(prev => [...prev, path]);
  };

  const closeFile = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = openTabs.filter(t => t !== path);
    setOpenTabs(next);
    if (selectedFile === path) setSelectedFile(next[next.length - 1] || '');
  };

  return {
    currentProjectId, setCurrentProjectId,
    workspace, setWorkspace,
    mobileTab, setMobileTab,
    messages, setMessages,
    input, setInput,
    isGenerating, setIsGenerating,
    executionQueue, setExecutionQueue,
    projectFiles, setProjectFiles,
    projectConfig, setProjectConfig,
    selectedFile, setSelectedFile,
    openTabs, setOpenTabs,
    toasts, addToast, removeToast,
    lastThought, setLastThought,
    currentPlan, setCurrentPlan,
    buildStatus, setBuildStatus,
    buildSteps, setBuildSteps,
    isDownloading, setIsDownloading,
    selectedImage, setSelectedImage,
    handleImageSelect,
    history, setHistory,
    isHistoryLoading, setIsHistoryLoading,
    showHistory, setShowHistory,
    handleRollback,
    previewOverride, setPreviewOverride,
    githubConfig, setGithubConfig,
    handleSend,
    handleBuildAPK,
    handleSecureDownload,
    loadProject,
    addFile,
    deleteFile,
    renameFile,
    openFile,
    closeFile
  };
};
