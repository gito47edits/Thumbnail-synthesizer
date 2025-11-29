import React, { useState, useEffect, useRef } from 'react';
import { generateThumbnailPlan, generateThumbnailImage, generateVoiceover, refinePrompt } from './services/geminiService';
import { ArtStyle, Emotion, GenerationState, AspectRatio, VoiceName, VoiceTone, LibraryItem } from './types';
import { PlanDisplay } from './components/PlanDisplay';
import { Terminal, Video, Settings, Image as ImageIcon, AlertTriangle, Smartphone, Monitor, Mic, Play, Download, Wifi, Battery, Code, Database, Trash2, Clock, Copy, Upload, X, Camera, Maximize2 } from 'lucide-react';

const App: React.FC = () => {
  // Config State
  const [script, setScript] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ArtStyle.HYPER_REALISTIC);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion>(Emotion.SHOCK);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [selectedTone, setSelectedTone] = useState<VoiceTone>(VoiceTone.NORMAL);
  
  // Reference Image State
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [applyRefToHumanOnly, setApplyRefToHumanOnly] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load Library on Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('thumbnail_library');
      if (stored) {
        setLibrary(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load library", e);
    }
  }, []);

  const addToLibrary = (item: LibraryItem) => {
    try {
      const updatedLibrary = [item, ...library].slice(0, 10); // Keep max 10 items to save space
      setLibrary(updatedLibrary);
      localStorage.setItem('thumbnail_library', JSON.stringify(updatedLibrary));
    } catch (e) {
      console.error("Storage limit reached", e);
      setState(prev => ({...prev, error: "STORAGE_WARNING: Local database full. Oldest items overwritten."}));
    }
  };

  const deleteFromLibrary = (id: string) => {
    const updatedLibrary = library.filter(item => item.id !== id);
    setLibrary(updatedLibrary);
    localStorage.setItem('thumbnail_library', JSON.stringify(updatedLibrary));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setReferenceImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      // Pass reference image if available. Always apply for Human version if set.
      const imageUrl = await generateThumbnailImage(
          state.strategy.human_version.image_prompt, 
          selectedAspectRatio, 
          referenceImage || undefined
      );

      setState(prev => ({ 
        ...prev, 
        isGeneratingHumanImage: false, 
        generatedImages: { ...prev.generatedImages, human: imageUrl } 
      }));
      
      // Add to Library
      addToLibrary({
        id: Date.now().toString(),
        type: 'human',
        imageUrl: imageUrl,
        prompt: state.strategy.human_version.image_prompt,
        timestamp: Date.now(),
        aspectRatio: selectedAspectRatio
      });

    } catch (err) {
      setState(prev => ({ ...prev, isGeneratingHumanImage: false, error: "RENDER ERROR: Human visual failed." }));
    }
  };

  const handleObjectImageGeneration = async () => {
    if (!state.strategy) return;
    setState(prev => ({ ...prev, isGeneratingObjectImage: true, error: null }));
    try {
      // Conditionally pass reference image based on user setting
      const refImg = (!applyRefToHumanOnly && referenceImage) ? referenceImage : undefined;
      
      const imageUrl = await generateThumbnailImage(
          state.strategy.object_version.image_prompt, 
          selectedAspectRatio,
          refImg
      );
      
      setState(prev => ({ 
        ...prev, 
        isGeneratingObjectImage: false, 
        generatedImages: { ...prev.generatedImages, object: imageUrl } 
      }));

      // Add to Library
      addToLibrary({
        id: Date.now().toString(),
        type: 'object',
        imageUrl: imageUrl,
        prompt: state.strategy.object_version.image_prompt,
        timestamp: Date.now(),
        aspectRatio: selectedAspectRatio
      });

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono selection:bg-green-500/30 selection:text-green-100 relative pb-12">
      
      {/* Matrix-like overlay effect */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[50] bg-[length:100%_2px,3px_100%] opacity-20"></div>

      {/* Pop Out Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className="relative p-1 bg-black border border-green-500 shadow-[0_0_100px_rgba(34,197,94,0.3)] animate-in zoom-in-95 duration-300 transform transition-transform"
                onMouseLeave={() => setPreviewImage(null)}
            >
                <img 
                    src={previewImage} 
                    className="max-w-[90vw] max-h-[90vh] object-contain block"
                    alt="Full Preview"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-green-500 text-xs font-bold tracking-widest bg-black/80 px-3 py-1 border border-green-900 rounded pointer-events-none">
                    EXIT_PERIMETER_TO_CLOSE
                </div>
            </div>
        </div>
      )}

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

             {/* REFERENCE IMAGE UPLOAD */}
             <div>
                <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">Reference_Protocol (Face/Style)</label>
                
                {!referenceImage ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-green-900 hover:border-green-500 bg-black p-4 text-center cursor-pointer transition-colors group"
                    >
                        <Upload size={16} className="mx-auto mb-2 text-green-800 group-hover:text-green-500" />
                        <span className="text-[10px] text-green-800 group-hover:text-green-400 uppercase font-bold">Upload Reference Data</span>
                    </div>
                ) : (
                    <div className="bg-green-900/10 border border-green-800 p-2 relative">
                        <img src={referenceImage} alt="Reference" className="w-full h-32 object-cover border border-green-900/50 opacity-80" />
                        <button 
                            onClick={clearReferenceImage}
                            className="absolute top-1 right-1 bg-black text-red-500 p-1 hover:bg-red-900 hover:text-white border border-red-900 transition-colors"
                        >
                            <X size={12} />
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="humanOnly" 
                                checked={applyRefToHumanOnly} 
                                onChange={(e) => setApplyRefToHumanOnly(e.target.checked)}
                                className="accent-green-500 bg-black border-green-900"
                            />
                            <label htmlFor="humanOnly" className="text-[10px] uppercase text-green-600 cursor-pointer select-none">
                                Lock to Human_Target
                            </label>
                        </div>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden" 
                />
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
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-black border border-green-900 p-6 min-h-[600px] relative overflow-hidden">
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
                    <div className="flex-1 bg-black border border-green-900/50 p-2 flex flex-col items-center justify-center overflow-hidden min-h-[200px] relative shadow-lg group">
                        {state.generatedImages.human ? (
                            <>
                                <img 
                                    src={state.generatedImages.human} 
                                    alt="Human Ver" 
                                    onClick={() => setPreviewImage(state.generatedImages.human)}
                                    className="w-full h-auto object-contain border border-green-800 cursor-zoom-in hover:opacity-90 transition-opacity hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                                />
                                <a 
                                    href={state.generatedImages.human} 
                                    download="human_thumb.png" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute bottom-2 right-2 bg-black/80 text-green-500 p-2 border border-green-500 hover:bg-green-900 z-20"
                                >
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
                    <div className="flex-1 bg-black border border-green-900/50 p-2 flex flex-col items-center justify-center overflow-hidden min-h-[200px] relative shadow-lg group">
                        {state.generatedImages.object ? (
                            <>
                                <img 
                                    src={state.generatedImages.object} 
                                    alt="Object Ver" 
                                    onClick={() => setPreviewImage(state.generatedImages.object)}
                                    className="w-full h-auto object-contain border border-green-800 cursor-zoom-in hover:opacity-90 transition-opacity hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                                />
                                <a 
                                    href={state.generatedImages.object} 
                                    download="object_thumb.png" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute bottom-2 right-2 bg-black/80 text-green-500 p-2 border border-green-500 hover:bg-green-900 z-20"
                                >
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

            {/* LIBRARY SECTION */}
            <div className="border border-green-900 bg-black p-4 relative">
                <div className="flex items-center justify-between border-b border-green-900/50 pb-2 mb-4">
                    <div className="flex items-center gap-2 text-green-500">
                        <Database size={16} />
                        <h3 className="text-sm font-bold tracking-widest uppercase">ARCHIVE_DATABASE</h3>
                    </div>
                    <span className="text-[10px] text-green-800">{library.length} / 10 SLOTS USED</span>
                </div>
                
                {library.length === 0 ? (
                    <div className="py-8 text-center text-green-900 text-xs tracking-widest border border-dashed border-green-900/30">
                        // NO_ARCHIVES_FOUND
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {library.map((item) => (
                            <div 
                                key={item.id} 
                                className="group relative bg-green-900/5 border border-green-900/50 hover:border-green-500 transition-colors"
                            >
                                <div 
                                    className="aspect-square w-full overflow-hidden bg-black/50 relative cursor-zoom-in"
                                    onClick={() => setPreviewImage(item.imageUrl)}
                                >
                                    <img src={item.imageUrl} alt="Archived" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                    {/* Type badge */}
                                    <div className="absolute top-1 left-1 bg-black/80 text-[8px] text-green-500 px-1 border border-green-900 pointer-events-none">
                                        {item.type === 'human' ? 'HUM' : 'OBJ'}
                                    </div>
                                    
                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                                        {/* To allow clicks on buttons but pass clicks on background to parent for preview, we need pointer-events-auto on buttons */}
                                        <a 
                                            href={item.imageUrl} 
                                            download={`archive_${item.id}.png`} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-green-400 hover:text-white p-1 pointer-events-auto" 
                                            title="Download"
                                        >
                                            <Download size={14} />
                                        </a>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(item.prompt);
                                            }}
                                            className="text-green-400 hover:text-white p-1 pointer-events-auto" 
                                            title="Copy Prompt"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteFromLibrary(item.id);
                                            }}
                                            className="text-red-500 hover:text-red-300 p-1 pointer-events-auto" 
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                         <div className="mt-1 text-[8px] text-green-600 font-bold uppercase tracking-widest pointer-events-none">
                                            Click to Expand
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 border-t border-green-900/50">
                                    <div className="flex items-center gap-1 text-[8px] text-green-700 mb-1">
                                        <Clock size={8} /> {formatDate(item.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;