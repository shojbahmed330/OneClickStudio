
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as UserType, ProjectConfig, Project, WorkspaceType, BuildStep, GithubConfig, ChatMessage } from '../types';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [executionQueue, setExecutionQueue] = useState<string[]>([]);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const projectFilesRef = useRef<Record<string, string>>({}); // Persistent ref to prevent state loss
  
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({ appName: 'OneClickApp', packageName: 'com.oneclick.studio' });
  const [selectedFile, setSelectedFile] = useState('app/index.html');
  const [openTabs, setOpenTabs] = useState<string[]>(['app/index.html']);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastThought, setLastThought] = useState<string>('');
  const [currentPlan, setCurrentPlan] = useState<string[]>([]);
  const [waitingForApproval, setWaitingForApproval] = useState(false);

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

  // Sync ref with state
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerNextStep = (remainingQueue: string[]) => {
    if (remainingQueue.length === 0) return;
    
    const nextTask = remainingQueue[0];
    const newQueue = remainingQueue.slice(1);
    setExecutionQueue(newQueue);
    
    const stepNum = currentPlan.length - newQueue.length;
    addToast(`Phase ${stepNum}/${currentPlan.length}: ${nextTask}`, 'info');

    const internalCommand = `EXECUTE PHASE ${stepNum}: ${nextTask}. 
    MANDATORY: Look at the CURRENT FILES and add/update code for this feature. 
    Return the COMPLETE content of any file you change. Do not omit existing logic.`;
    
    handleSend(internalCommand, true, newQueue);
  };

  const handleSend = async (customPrompt?: string, isAuto: boolean = false, overrideQueue?: string[]) => {
    if (isGenerating && !isAuto) return;

    const promptText = (customPrompt || input).trim();
    const activeQueue = overrideQueue !== undefined ? overrideQueue : executionQueue;
    
    // Approval handling logic for buttons
    if (waitingForApproval && !isAuto) {
      const lowerInput = promptText.toLowerCase();
      if (lowerInput === 'yes' || lowerInput === 'ha' || lowerInput === 'proceed' || lowerInput === 'y') {
        setWaitingForApproval(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: "Yes, proceed with next step.", timestamp: Date.now() }]);
        setInput('');
        triggerNextStep(activeQueue);
        return;
      } else {
        setWaitingForApproval(false);
        setExecutionQueue([]);
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), role: 'user', content: "No, stop.", timestamp: Date.now() 
        }, {
          id: (Date.now() + 1).toString(), role: 'assistant', content: "ঠিক আছে, আমি অটোমেটিক প্ল্যান বন্ধ করে দিয়েছি।", timestamp: Date.now() + 1
        }]);
        setInput('');
        return;
      }
    }

    setIsGenerating(true);

    try {
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

      // Always pass the LATEST files from Ref
      const res = await gemini.current.generateWebsite(promptText, projectFilesRef.current, messages, currentImage, projectConfig);
      
      if (res.thought) setLastThought(res.thought);
      
      let updatedFiles = { ...projectFilesRef.current };
      if (res.files && Object.keys(res.files).length > 0) {
        updatedFiles = { ...updatedFiles, ...res.files };
        setProjectFiles(updatedFiles);
        projectFilesRef.current = updatedFiles; // Immediate sync
      }

      let nextPlan = currentPlan;
      if (res.plan && res.plan.length > 0 && !isAuto) {
        nextPlan = res.plan;
        setCurrentPlan(res.plan);
        const initialQueue = res.plan.slice(1);
        setExecutionQueue(initialQueue);
      }

      const hasMoreSteps = (isAuto && activeQueue.length > 0) || (!isAuto && nextPlan.length > 1);
      let isApproval = false;
      let assistantResponse = res.answer;

      if (hasMoreSteps) {
        const nextStepName = isAuto ? activeQueue[0] : nextPlan[1];
        assistantResponse += `\n\n**আমার বর্তমান কাজ শেষ। আমি কি পরবর্তী ধাপে যাব?**\n(পরবর্তী ধাপ: ${nextStepName})`;
        setWaitingForApproval(true);
        isApproval = true;
      } else {
        setWaitingForApproval(false);
      }

      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(),
        role: 'assistant', 
        content: assistantResponse, 
        plan: res.plan || (isAuto ? currentPlan : []),
        timestamp: Date.now(),
        isApproval
      }]);

      if (currentProjectId && user) {
        await db.updateProject(user.id, currentProjectId, updatedFiles, projectConfig);
      }

    } catch (err: any) {
      addToast(err.message, 'error');
      setExecutionQueue([]); 
      setWaitingForApproval(false);
    } finally {
      setIsGenerating(false);
    }
  };

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
    projectFilesRef.current = project.files;
    if (project.config) setProjectConfig(project.config);
  };

  const handleRollback = async (files: Record<string, string>, message: string) => {
    setProjectFiles(files);
    projectFilesRef.current = files;
    addToast(`Restored to: ${message}`, 'success');
    setPreviewOverride(null);
  };

  const handleBuildAPK = async (onConfigRequired: () => void) => {
    if (!githubConfig.token || !githubConfig.owner) {
      addToast("Uplink Credentials Required.", "error");
      onConfigRequired();
      return;
    }
    setBuildStatus({ status: 'pushing', message: 'Syncing source code...' });
    setBuildSteps([{ name: 'Initializing Build Cluster', status: 'completed', conclusion: 'success' }]);
  };

  const handleSecureDownload = () => {
    addToast("Generating secure download package...", "info");
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
    closeFile,
    waitingForApproval
  };
};
