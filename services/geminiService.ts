import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { ArtStyle, Emotion, ThumbnailStrategy, AspectRatio, VoiceName, VoiceTone } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CONCEPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    visual_hook: {
      type: Type.STRING,
      description: "The core visual concept."
    },
    rationale: {
      type: Type.STRING,
      description: "Why this works for CTR."
    },
    text_overlay: {
      type: Type.STRING,
      description: "Text on thumbnail (max 2-3 words)."
    },
    image_prompt: {
      type: Type.STRING,
      description: "Detailed image generation prompt."
    }
  },
  required: ["visual_hook", "rationale", "text_overlay", "image_prompt"]
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    human_version: {
      ...CONCEPT_SCHEMA,
      description: "A thumbnail concept featuring a human subject (face/expression)."
    },
    object_version: {
      ...CONCEPT_SCHEMA,
      description: "A thumbnail concept focused PURELY on objects/environment (no humans)."
    }
  },
  required: ["human_version", "object_version"]
};

/**
 * Generates a thumbnail strategy with TWO variations (Human vs Object).
 */
export const generateThumbnailPlan = async (
  script: string,
  style: ArtStyle,
  emotion: Emotion,
  aspectRatio: AspectRatio
): Promise<ThumbnailStrategy> => {
  const systemPrompt = `
    You are an elite YouTube Algorithm Hacker. Your goal is to exploit human psychology to maximize CTR.
    
    Analyze the script and generate TWO distinct thumbnail concepts:
    1. **HUMAN_VERSION**: Focuses on a person's reaction or face. Must show emotion '${emotion}'.
    2. **OBJECT_VERSION**: Focuses purely on the main object, environment, or mystery element. NO HUMANS.

    Global Style: '${style}'.
    Aspect Ratio: ${aspectRatio}.

    CRITICAL RULES:
    - **Visual Hook**: Find the most "clickbaity" element. If boring, exaggerate it.
    - **Text Overlay**: 0-3 words. MUST be "punchy yellow text".
    - **Composition**:
       - If 16:9: Wide, cinematic.
       - If 9:16: Tall, centered subject.
    - **Prompt Engineering**: The 'image_prompt' must be highly detailed for DALL-E 3 / Midjourney.
       - MUST include: "Text overlay in huge, bold, bright yellow font that says 'TEXT_OVERLAY'" (replace TEXT_OVERLAY with your text).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: script,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.8,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as ThumbnailStrategy;
  } catch (error) {
    console.error("Plan Generation Error:", error);
    throw new Error("Failed to generate thumbnail strategy.");
  }
};

/**
 * Refines an existing prompt based on user instructions.
 */
export const refinePrompt = async (currentPrompt: string, userInstructions: string): Promise<string> => {
  const systemPrompt = `
    You are an expert prompt engineer for DALL-E 3 and Midjourney.
    Your task is to REWRITE the following prompt based on the user's specific instructions.
    
    Rules:
    - Keep the core high-quality style keywords (e.g., 8k, hyper-realistic) unless explicitly told to remove them.
    - Focus on implementing the USER_INSTRUCTIONS.
    - Output ONLY the new prompt text. Do not output markdown or explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `CURRENT_PROMPT: "${currentPrompt}"\n\nUSER_INSTRUCTIONS: "${userInstructions}"\n\nNEW_PROMPT:`,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Prompt Refinement Error:", error);
    throw new Error("Failed to refine prompt.");
  }
};

/**
 * Generates the actual image using the plan's prompt and optional reference image.
 */
export const generateThumbnailImage = async (
  prompt: string, 
  aspectRatio: AspectRatio,
  referenceImage?: string
): Promise<string> => {
  try {
    const parts: any[] = [];

    // If a reference image is provided, add it to the request parts
    if (referenceImage) {
      // Extract mime type and base64 data
      // format: data:image/png;base64,.....
      const matches = referenceImage.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
        // Add instruction to use the image
        parts.push({ text: "Use the attached image as a heavy visual reference for the main subject/character in the following prompt: " });
      }
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    if (response.candidates && response.candidates[0].content.parts) {
       for (const part of response.candidates[0].content.parts) {
         if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
         }
       }
    }

    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw new Error("Failed to generate image.");
  }
};

/**
 * Generates voiceover audio.
 */
export const generateVoiceover = async (text: string, voiceName: VoiceName, tone: VoiceTone): Promise<string> => {
  try {
    let contentText = text;
    if (tone !== VoiceTone.NORMAL) {
        contentText = `Say ${tone}: ${text}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: contentText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data generated.");
    }

    const pcmData = base64ToUint8Array(base64Audio);
    const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16); 
    const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw new Error("Failed to generate voiceover.");
  }
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF'); 
  view.setUint32(4, 36 + dataLength, true); 
  writeString(view, 8, 'WAVE'); 
  writeString(view, 12, 'fmt '); 
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); 
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); 
  view.setUint16(34, bitsPerSample, true); 
  writeString(view, 36, 'data'); 
  view.setUint32(40, dataLength, true); 

  return header;
}