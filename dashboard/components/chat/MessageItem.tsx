
import React, { useState } from 'react';
import { Sparkles, Zap, Database, Copy, Check, ListChecks, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';
import Questionnaire from '../Questionnaire';
import { useLanguage } from '../../../i18n/LanguageContext';

interface MessageItemProps {
  message: any;
  index: number;
  handleSend: (extraData?: string) => void;
  isLatest?: boolean;
  waitingForApproval?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message: m, index: idx, handleSend, isLatest, waitingForApproval }) => {
  const { t } = useLanguage();
  const [copiedSql, setCopiedSql] = useState(false);
  const [selectionMade, setSelectionMade] = useState(false);

  const sqlFile = m.files && m.files['database.sql'];
  const hasDiffs = m.diffs && Object.keys(m.diffs).length > 0;

  const copySql = () => {
    if (sqlFile) {
      navigator.clipboard.writeText(sqlFile);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  const onApprovalClick = (choice: 'Yes' | 'No') => {
    if (selectionMade) return;
    setSelectionMade(true);
    handleSend(choice);
  };
  
  return (
    <div 
      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both w-full`}
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <div className="flex flex-col items-start w-full max-w-full">
        {m.role === 'assistant' && (
          <div className="flex items-center gap-3 mb-3 ml-2">
            <div className="w-6 h-6 bg-pink-500/10 rounded-lg border border-pink-500/30 flex items-center justify-center">
              <Sparkles size={12} className="text-pink-500"/>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500">Neural Agent</span>
            
            {hasDiffs && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md animate-in fade-in duration-1000">
                <ArrowUpRight size={10} className="text-green-500" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-green-500">Optimized Patch</span>
              </div>
            )}
          </div>
        )}
        
        <div className={`
          max-w-[95%] md:max-w-[92%] p-5 rounded-3xl text-[13px] leading-relaxed transition-all relative break-words overflow-hidden w-full
          ${m.role === 'user' 
            ? 'bg-pink-600 text-white rounded-tr-sm self-end shadow-lg shadow-pink-600/10' 
            : 'bg-white/5 border border-white/10 rounded-tl-sm self-start text-zinc-300'}
        `}>
          {m.image && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <img src={m.image} className="w-full max-h-[300px] object-cover" alt="Uploaded UI" />
            </div>
          )}

          {/* AI Plan Visualization */}
          {m.plan && m.plan.length > 0 && m.role === 'assistant' && (
            <div className="mb-6 bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                 <ListChecks size={16} className="text-pink-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white">Execution Plan</span>
              </div>
              <div className="space-y-3">
                {m.plan.map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0 mt-0.5">
                       <span className="text-[9px] font-black text-pink-500">{i + 1}</span>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400 leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative z-10 whitespace-pre-wrap font-medium break-words">
            {m.content && m.content.split(/(\*\*.*?\*\*)/g).map((part: string, i: number) => 
              part.startsWith('**') && part.endsWith('**') 
              ? <strong key={i} className={m.role === 'user' ? 'text-white' : 'text-pink-400'} style={{fontWeight: 900}}>{part.slice(2, -2)}</strong> 
              : part
            )}
          </div>

          {/* Approval Buttons - Simplified Logic to ensure visibility */}
          {m.isApproval && isLatest && !selectionMade && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3 animate-in slide-in-from-top-4 duration-500">
               <button 
                  onClick={() => onApprovalClick('Yes')}
                  className="flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-900/40 group border border-emerald-400/30"
               >
                  <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />
                  Yes, Proceed
               </button>
               <button 
                  onClick={() => onApprovalClick('No')}
                  className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 hover:bg-red-600/10 hover:border-red-500/40 text-zinc-400 hover:text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 group"
               >
                  <XCircle size={16} className="group-hover:rotate-90 transition-transform" />
                  No, Stop
               </button>
            </div>
          )}

          {sqlFile && m.role === 'assistant' && (
            <div className="mt-5 p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                     <Database size={16}/>
                   </div>
                   <div>
                     <div className="text-[10px] font-black uppercase tracking-widest text-white">Database Schema</div>
                     <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Ready for Import</div>
                   </div>
                </div>
                <button 
                  onClick={copySql}
                  className={`p-2.5 rounded-xl transition-all ${copiedSql ? 'bg-green-500 text-white' : 'bg-white/5 text-indigo-400 hover:bg-white/10'}`}
                >
                  {copiedSql ? <Check size={14}/> : <Copy size={14}/>}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-medium italic">
                {t('shop.verify_desc')}
              </p>
            </div>
          )}

          {m.answersSummary ? (
            <div className="mt-4 p-5 bg-white/5 border border-white/5 rounded-2xl italic text-zinc-500 text-[11px] leading-relaxed break-words">
              <div className="flex items-center gap-2 mb-1">
                 <Zap size={10} className="text-pink-500"/>
                 <span className="font-black uppercase text-[9px] tracking-widest text-pink-500">Configuration Locked</span>
              </div>
              {m.answersSummary.split('\n').map((line: string, i: number) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : (
            m.questions && m.questions.length > 0 && (
              <Questionnaire 
                questions={m.questions} 
                onComplete={(answers) => handleSend(answers)}
                onSkip={() => handleSend("Proceed with defaults.")}
              />
            )
          )}
        </div>
        
        <div className={`text-[8px] mt-3 font-black uppercase tracking-widest text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ${m.role === 'user' ? 'mr-4 self-end' : 'ml-4 self-start'}`}>
          {new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
