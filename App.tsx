import React, { useState } from 'react';
import { generateThumbnailPlan, generateThumbnailImage, generateVoiceover, refinePrompt } from './services/geminiService';
import { ArtStyle, Emotion, GenerationState, AspectRatio, VoiceName, VoiceTone } from './types';
import { PlanDisplay } from './components/PlanDisplay';
import { Terminal, Video, Settings, Image as ImageIcon, AlertTriangle, Smartphone, Monitor, Mic, Play, Download, Wifi, Battery, Code } from 'lucide-react';

const App: React.FC = () => {
  // Config State
  const [script, setScript] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ArtStyle.HYPER_REALISTIC);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion>(Emotion.SHOCK);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [selectedTone, setSelectedTone] = useState<VoiceTone>(VoiceTone.NORMAL);

  // Functional State
  const [state, setState] = useState<GenerationState>({
    isPlanning: false,
    isGeneratingHumanImage: false,
    isGeneratingObjectImage: false,
    isGeneratingVoice: false,
    strategy: null,
    generatedImages: { human: null, object: null },
    voiceUrl: null,
    error: null,
  });

  const handlePlanGeneration = async () => {
    if (!script.trim()) return;
    
    setState(prev => ({ 
      ...prev, 
      isPlanning: true, 
      error: null, 
      strategy: null, 
      generatedImages: { human: null, object: null } 
    }));

    try {
      const strategy = await generateThumbnailPlan(script, selectedStyle, selectedEmotion, selectedAspectRatio);
      setState(prev => ({ ...prev, isPlanning: false, strategy }));
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        isPlanning: false, 
        error: "SYSTEM FAILURE: Could not decrypt script." 
      }));
    }
  };

  const handleHumanImageGeneration = async () => {
    if (!state.strategy) return;
    setState(prev => ({ ...prev, isGeneratingHumanImage: true, error: null }));
    try {
      const imageUrl = await generateThumbnailImage(state.strategy.human_version.image_prompt, selectedAspectRatio);
      setState(prev => ({ 
        ...prev, 
        isGeneratingHumanImage: false, 
        generatedImages: { ...prev.generatedImages, human: imageUrl } 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isGeneratingHumanImage: false, error: "RENDER ERROR: Human visual failed." }));
    }
  };

  const handleObjectImageGeneration = async () => {
    if (!state.strategy) return;
    setState(prev => ({ ...prev, isGeneratingObjectImage: true, error: null }));
    try {
      const imageUrl = await generateThumbnailImage(state.strategy.object_version.image_prompt, selectedAspectRatio);
      setState(prev => ({ 
        ...prev, 
        isGeneratingObjectImage: false, 
        generatedImages: { ...prev.generatedImages, object: imageUrl } 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isGeneratingObjectImage: false, error: "RENDER ERROR: Object visual failed." }));
    }
  };

  const handleVoiceGeneration = async () => {
    if (!script.trim()) return;
    setState(prev => ({ ...prev, isGeneratingVoice: true, error: null }));
    try {
      const url = await generateVoiceover(script.slice(0, 1000), selectedVoice, selectedTone); 
      setState(prev => ({ ...prev, isGeneratingVoice: false, voiceUrl: url }));
    } catch (err) {
      setState(prev => ({ ...prev, isGeneratingVoice: false, error: "AUDIO SYNTHESIS FAILED." }));
    }
  };

  const handleRefinePrompt = async (version: 'human' | 'object', instruction: string) => {
    if (!state.strategy) return;
    
    const currentConcept = version === 'human' ? state.strategy.human_version : state.strategy.object_version;
    
    try {
      const newPrompt = await refinePrompt(currentConcept.image_prompt, instruction);
      
      setState(prev => {
        if (!prev.strategy) return prev;
        return {
          ...prev,
          strategy: {
            ...prev.strategy,
            [version === 'human' ? 'human_version' : 'object_version']: {
              ...currentConcept,
              image_prompt: newPrompt
            }
          }
        };
      });
    } catch (err) {
      setState(prev => ({ ...prev, error: `REMIX ERROR: Failed to refine ${version} prompt.` }));
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono selection:bg-green-500/30 selection:text-green-100 relative">
      
      {/* Matrix-like overlay effect */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[50] bg-[length:100%_2px,3px_100%] opacity-20"></div>

      {/* Header */}
      <header className="border-b border-green-900/50 bg-black sticky top-0 z-40 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-900/20 p-2 border border-green-500/30">
              <Terminal className="text-green-500 animate-pulse" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-green-500">
              THUMBNAIL_ALCHEMIST <span className="text-xs align-top text-green-700">v2.5</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-green-700 font-bold">
             <div className="hidden md:flex items-center gap-1"><Wifi size={12}/> ONLINE</div>
             <div className="hidden md:flex items-center gap-1"><Battery size={12}/> 100%</div>
             <span className="bg-green-900/20 px-2 py-1 border border-green-800 rounded">SYS: GEMINI_2.5_FLASH</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: Input & Settings (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Script Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-green-600 mb-1 border-b border-green-900/50 pb-2">
              <div className="flex items-center gap-2">
                <Code size={16} />
                <h2 className="text-xs font-bold uppercase tracking-widest">Input_Stream</h2>
              </div>
              <span className="text-[10px] animate-pulse">AWAITING DATA...</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder=">> PASTE_SCRIPT_HERE..."
              className="w-full h-40 bg-black border border-green-900 text-green-400 placeholder-green-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-all resize-none text-xs leading-relaxed p-4 custom-scrollbar"
            />
          </div>

           {/* Audio Section */}
           <div className="border border-green-900 bg-green-900/5 p-5">
              <div className="flex items-center gap-2 text-green-600 mb-4 border-b border-green-900/30 pb-2">
                <Mic size={16} />
                <h2 className="text-xs font-bold uppercase tracking-widest">Audio_Synthesis</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="block text-[10px] font-bold text-green-700 mb-1 uppercase">Voice_ID</label>
                    <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                        className="w-full bg-black border border-green-800 text-green-400 p-2 text-xs focus:border-green-500 outline-none"
                    >
                        {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-green-700 mb-1 uppercase">Modulation</label>
                    <select 
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value as VoiceTone)}
                        className="w-full bg-black border border-green-800 text-green-400 p-2 text-xs focus:border-green-500 outline-none"
                    >
                        {Object.values(VoiceTone).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  onClick={handleVoiceGeneration}
                  disabled={!script || state.isGeneratingVoice}
                  className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider border transition-all
                    ${!script ? 'border-green-900 text-green-900' : 'bg-green-900/20 border-green-600 text-green-400 hover:bg-green-900/40 hover:text-green-200'}`}
                 >
                    {state.isGeneratingVoice ? <span className="animate-pulse">SYNTHESIZING...</span> : <><Play size={12}/> EXECUTE_TTS</>}
                 </button>

                 {state.voiceUrl && (
                   <div className="flex items-center gap-2 bg-green-900/10 p-2 border border-green-800">
                      <audio controls src={state.voiceUrl} className="w-full h-6 opacity-70" />
                      <a href={state.voiceUrl} download="voice_output.wav" className="text-green-500 hover:text-green-300">
                        <Download size={16} />
                      </a>
                   </div>
                 )}
              </div>
           </div>

          {/* Config Section */}
          <div className="border border-green-900 bg-green-900/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-600 mb-2 border-b border-green-900/30 pb-2">
              <Settings size={16} />
              <h2 className="text-xs font-bold uppercase tracking-widest">Visual_Params</h2>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-green-700 uppercase">Output_Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setSelectedAspectRatio('16:9')}
                  className={`flex items-center justify-center gap-2 p-2 border text-xs font-bold transition-all ${
                    selectedAspectRatio === '16:9' 
                      ? 'bg-green-500 text-black border-green-500' 
                      : 'bg-black border-green-900 text-green-700 hover:border-green-700'
                  }`}
                >
                  <Monitor size={14} /> 16:9
                </button>
                <button 
                  onClick={() => setSelectedAspectRatio('9:16')}
                  className={`flex items-center justify-center gap-2 p-2 border text-xs font-bold transition-all ${
                    selectedAspectRatio === '9:16' 
                      ? 'bg-green-500 text-black border-green-500' 
                      : 'bg-black border-green-900 text-green-700 hover:border-green-700'
                  }`}
                >
                  <Smartphone size={14} /> 9:16
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-green-700 uppercase mb-1">Style_Matrix</label>
                <select 
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value as ArtStyle)}
                  className="w-full bg-black border border-green-800 text-green-400 p-2 text-xs focus:border-green-500 outline-none"
                >
                  {Object.values(ArtStyle).map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-green-700 uppercase mb-1">Emotion_Engine</label>
                <select 
                  value={selectedEmotion}
                  onChange={(e) => setSelectedEmotion(e.target.value as Emotion)}
                  className="w-full bg-black border border-green-800 text-green-400 p-2 text-xs focus:border-green-500 outline-none"
                >
                  {Object.values(Emotion).map(emotion => (
                    <option key={emotion} value={emotion}>{emotion}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handlePlanGeneration}
            disabled={!script || state.isPlanning}
            className={`w-full py-4 text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all
              ${!script 
                ? 'bg-black border border-green-900 text-green-900 cursor-not-allowed' 
                : state.isPlanning
                  ? 'bg-green-900/20 border border-green-500 text-green-500 animate-pulse'
                  : 'bg-green-600 text-black hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
              }`}
          >
            {state.isPlanning ? 'DECRYPTING...' : 'INITIATE_ALGORITHM'}
          </button>

          {state.error && (
            <div className="p-3 bg-red-900/10 border border-red-500/50 flex items-start gap-2 text-red-500 text-xs font-bold">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Results (8 cols) */}
        <div className="lg:col-span-8 bg-black border border-green-900 p-6 min-h-[600px] relative overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(0,50,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,50,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          
          {!state.strategy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
               <div className="w-24 h-24 border border-green-900 rounded-full flex items-center justify-center mb-4 animate-[spin_10s_linear_infinite]">
                 <div className="w-16 h-16 border border-green-800 rounded-full border-t-green-500 animate-[spin_3s_linear_infinite]"></div>
               </div>
               <p className="text-green-800 font-bold tracking-widest text-sm typing-cursor">AWAITING_STRATEGY_PROTOCOL</p>
            </div>
          )}

          {state.strategy && (
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
              
              {/* Human Version */}
              <div className="flex flex-col gap-4">
                 <div className="flex-1 bg-black border border-green-900/50 p-2 flex flex-col items-center justify-center overflow-hidden min-h-[200px] relative shadow-lg">
                    {state.generatedImages.human ? (
                         <>
                            <img src={state.generatedImages.human} alt="Human Ver" className="w-full h-auto object-contain border border-green-800" />
                            <a href={state.generatedImages.human} download="human_thumb.png" className="absolute bottom-2 right-2 bg-black/80 text-green-500 p-2 border border-green-500 hover:bg-green-900">
                                <Download size={16} />
                            </a>
                         </>
                    ) : (
                        <div className="text-green-900 flex flex-col items-center">
                            <ImageIcon size={32} className="mb-2"/>
                            <span className="text-[10px] tracking-widest">NO_IMAGE_DATA</span>
                        </div>
                    )}
                 </div>
                 <PlanDisplay 
                    title="01 // HUMAN_TARGET" 
                    concept={state.strategy.human_version}
                    onGenerateImage={handleHumanImageGeneration}
                    isGeneratingImage={state.isGeneratingHumanImage}
                    onRefinePrompt={(instruction) => handleRefinePrompt('human', instruction)}
                 />
              </div>

              {/* Object Version */}
              <div className="flex flex-col gap-4">
                 <div className="flex-1 bg-black border border-green-900/50 p-2 flex flex-col items-center justify-center overflow-hidden min-h-[200px] relative shadow-lg">
                    {state.generatedImages.object ? (
                        <>
                            <img src={state.generatedImages.object} alt="Object Ver" className="w-full h-auto object-contain border border-green-800" />
                            <a href={state.generatedImages.object} download="object_thumb.png" className="absolute bottom-2 right-2 bg-black/80 text-green-500 p-2 border border-green-500 hover:bg-green-900">
                                <Download size={16} />
                            </a>
                        </>
                    ) : (
                        <div className="text-green-900 flex flex-col items-center">
                            <ImageIcon size={32} className="mb-2"/>
                            <span className="text-[10px] tracking-widest">NO_IMAGE_DATA</span>
                        </div>
                    )}
                 </div>
                 <PlanDisplay 
                    title="02 // OBJECT_TARGET" 
                    concept={state.strategy.object_version}
                    onGenerateImage={handleObjectImageGeneration}
                    isGeneratingImage={state.isGeneratingObjectImage}
                    onRefinePrompt={(instruction) => handleRefinePrompt('object', instruction)}
                 />
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;