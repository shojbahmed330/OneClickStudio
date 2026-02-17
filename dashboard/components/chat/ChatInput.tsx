
import React, { useRef } from 'react';
import { Image as ImageIcon, Send, X, Layers } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';

interface ChatInputProps {
  input: string;
  setInput: (s: string) => void;
  isGenerating: boolean;
  handleSend: () => void;
  selectedImage: { data: string; mimeType: string; preview: string } | null;
  setSelectedImage: (img: any) => void;
  handleImageSelect: (file: File) => void;
  executionQueue: string[];
}

const ChatInput: React.FC<ChatInputProps> = ({
  input, setInput, isGenerating, handleSend, selectedImage, setSelectedImage, handleImageSelect, executionQueue
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 md:p-8 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent pt-12 z-[100]">
      
      {/* Visual Execution Queue Badge - Repositioned to bottom-full to sit above input */}
      {executionQueue && executionQueue.length > 0 && (
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2 bg-pink-600/10 border border-pink-500/40 rounded-full backdrop-blur-xl animate-in slide-in-from-bottom-2 shadow-xl shadow-pink-600/10 z-[110]">
           <Layers size={14} className="text-pink-500 animate-pulse"/>
           <span className="text-[10px] font-black uppercase text-pink-400 tracking-widest">
             {executionQueue.length} Tasks Auto-Queued
           </span>
        </div>
      )}

      {selectedImage && (
        <div className="mb-3 animate-in slide-in-from-bottom-4 duration-500">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-pink-500/50 shadow-xl group">
            <img src={selectedImage.preview} className="w-full h-full object-cover" alt="Selected" />
            <button onClick={() => setSelectedImage(null)} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={12}/>
            </button>
          </div>
        </div>
      )}
      <div className="relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2 md:p-3 flex items-center gap-2 md:gap-3 mb-20 md:mb-0 shadow-2xl focus-within:border-pink-500/40 transition-all">
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />
         <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 md:w-12 md:h-12 text-zinc-500 hover:text-pink-500 hover:bg-white/5 rounded-2xl transition-all flex items-center justify-center">
           <ImageIcon size={20}/>
         </button>
         <textarea 
           value={input} 
           onChange={e => setInput(e.target.value)} 
           onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
           placeholder={t('chat.placeholder')} 
           className="flex-1 bg-transparent p-2 text-[13px] h-12 outline-none text-white resize-none placeholder:text-zinc-700 font-bold" 
         />
         <button onClick={handleSend} disabled={isGenerating || (!input.trim() && !selectedImage)} className="w-10 h-10 md:w-12 md:h-12 bg-pink-600 text-white rounded-2xl flex items-center justify-center active:scale-95 disabled:opacity-30 transition-all shadow-lg shadow-pink-600/20">
           <Send size={16}/>
         </button>
      </div>
    </div>
  );
};

export default ChatInput;
