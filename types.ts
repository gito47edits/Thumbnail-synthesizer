
export interface ThumbnailConcept {
  rationale: string;
  image_prompt: string;
  visual_hook: string;
  text_overlay: string;
}

export interface ThumbnailStrategy {
  human_version: ThumbnailConcept;
  object_version: ThumbnailConcept;
}

export enum ArtStyle {
  HYPER_REALISTIC = 'Hyper-Realistic 8K',
  COMIC_BOOK = 'Vibrant Comic Book',
  MINIMALIST = 'Clean Minimalist',
  CYBERPUNK = 'Neon Cyberpunk',
  PIXAR_STYLE = '3D Animation Style',
  SURREALISM = 'Dreamy Surrealism',
  GLITCH_ART = 'Hacker Glitch Art'
}

export enum Emotion {
  SHOCK = 'Shock/Surprise',
  CURIOSITY = 'Deep Curiosity',
  ANGER = 'Conflict/Anger',
  JOY = 'Pure Joy',
  FEAR = 'Eerie/Scary'
}

export type AspectRatio = '16:9' | '9:16';

export enum VoiceName {
  Kore = 'Kore',
  Zephyr = 'Zephyr',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir'
}

export enum VoiceTone {
  NORMAL = 'Normally',
  EXCITED = 'Cheerfully and excitedly',
  DRAMATIC = 'with a deep, dramatic movie trailer voice',
  MYSTERIOUS = 'in a mysterious, whispering tone',
  URGENT = 'fast and urgently'
}

export interface GenerationState {
  isPlanning: boolean;
  isGeneratingHumanImage: boolean;
  isGeneratingObjectImage: boolean;
  isGeneratingVoice: boolean;
  strategy: ThumbnailStrategy | null;
  generatedImages: {
    human: string | null;
    object: string | null;
  };
  voiceUrl: string | null;
  error: string | null;
}

export interface LibraryItem {
  id: string;
  type: 'human' | 'object';
  imageUrl: string;
  prompt: string;
  timestamp: number;
  aspectRatio: AspectRatio;
}
