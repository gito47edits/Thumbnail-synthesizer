import React, { useState } from 'react';
import { ThumbnailConcept } from '../types';
import { Terminal, Copy, Check, Cpu, Wand2 } from 'lucide-react';

interface PlanDisplayProps {
  title: string;
  concept: ThumbnailConcept;
  onGenerateImage: () => void;
  isGeneratingImage: boolean;
  onRefinePrompt: (instruction: string) => Promise<void>;
}

export const PlanDisplay: React.FC<PlanDisplayProps> = ({ 
  title, 
  concept, 
  onGenerateImage, 
  isGeneratingImage,
  onRefinePrompt
}) => {
  const [copied, setCopied] = useState(false);
  const [remixInstruction, setRemixInstruction] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(concept.image_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemix = async () => {
    if (!remixInstruction.trim() || isRemixing) return;
    setIsRemixing(true);
    try {
      await onRefinePrompt(remixInstruction);
      setRemixInstruction('');
    } finally {
      setIsRemixing(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in w-full">
      <div className="flex items-center gap-2 text-green-400 border-b border-green-900 pb-2 mb-2">
        <Terminal size={18} />
        <h3 className="text-lg font-bold tracking-widest uppercase">{title}</h3>
      </div>

      {/* Rationale Section */}
      <div className="bg-black border border-green-900/50 p-4 shadow-[0_0_10px_rgba(34,197,94,0.1)] relative">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-500"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-500"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-500"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-500"></div>

        <h4 className="text-sm font-bold text-green-500 mb-2 flex items-center gap-2">
          <span className="animate-pulse">>></span> VISUAL_HOOK
        </h4>
        <p className="text-green-300 leading-relaxed mb-4 text-sm font-light">{concept.visual_hook}</p>
        
        <div className="bg-green-900/10 p-3 border-l-2 border-green-600 mb-3">
           <h5 className="text-xs font-bold text-green-600 uppercase mb-1">RATIONALE_LOG</h5>
           <p className="text-xs text-green-400/80">{concept.rationale}</p>
        </div>
        
         <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-green-600 uppercase">OVERLAY_TEXT:</span>
            <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-sm font-bold border border-yellow-500/30 font-sans tracking-wide">
                {concept.text_overlay || "NULL"}
            </span>
         </div>
      </div>

      {/* Prompt Section */}
      <div className="bg-black border border-green-900 p-4 relative group">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button 
            onClick={handleCopy}
            className="p-1.5 bg-green-900 hover:bg-green-800 border border-green-700 text-green-300 transition-colors"
            title="Copy Prompt"
          >
            {copied ? <Check size={14} /> : <Copy size={14}/>}
          </button>
        </div>
        
        <h4 className="text-xs font-bold text-green-600 mb-2 uppercase">PROMPT_CODE</h4>
        <div className="bg-black p-2 border border-green-900/50 text-xs text-green-500/70 leading-relaxed whitespace-pre-wrap font-mono h-32 overflow-y-auto custom-scrollbar">
          {concept.image_prompt}
        </div>

        {/* Remix Module */}
        <div className="mt-3 border-t border-green-900/50 pt-3">
          <label className="text-[10px] font-bold text-green-700 uppercase mb-1 flex items-center gap-2">
            <Wand2 size={10} /> PROMPT_REMIX_MODULE
          </label>
          <div className="flex gap-2">
            <input 
              type="text"
              value={remixInstruction}
              onChange={(e) => setRemixInstruction(e.target.value)}
              placeholder="ENTER_MODIFICATION_VECTORS..."
              className="flex-1 bg-green-900/10 border border-green-800 text-green-400 placeholder-green-800 text-xs p-2 focus:border-green-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleRemix()}
            />
            <button 
              onClick={handleRemix}
              disabled={isRemixing || !remixInstruction}
              className={`p-2 border transition-all ${
                isRemixing || !remixInstruction
                ? 'border-green-900 text-green-900 bg-black cursor-not-allowed'
                : 'border-green-600 text-green-400 bg-green-900/20 hover:bg-green-900/40 hover:text-green-200'
              }`}
              title="Remix Prompt"
            >
              <Wand2 size={14} className={isRemixing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Action */}
      <button
        onClick={onGenerateImage}
        disabled={isGeneratingImage}
        className={`w-full py-3 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all border
          ${isGeneratingImage 
            ? 'bg-green-900/20 border-green-900 text-green-700 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-500 text-black border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]'
          }`}
      >
        {isGeneratingImage ? (
          <>
            <span className="animate-spin">|</span> EXECUTING...
          </>
        ) : (
          <>
            <Cpu size={16} /> RENDER_VISUAL
          </>
        )}
      </button>
    </div>
  );
};