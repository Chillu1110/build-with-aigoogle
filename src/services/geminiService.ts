import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ImageAnalysisResult {
  isFake: boolean;
  riskScore: number;
  analysis: string;
  artifacts: string[];
  forensicPoints: { x: number; y: number; label: string; intensity: number }[];
  verdict: "Safe" | "Suspicious" | "High-Risk";
}

export interface TextAnalysisResult {
  isReliable: boolean;
  riskScore: number;
  analysis: string;
  flags: string[];
  verdict: "Safe" | "Suspicious" | "High-Risk";
  nextSteps: string[];
}

export async function analyzeImage(base64Image: string, mimeType: string): Promise<ImageAnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          {
            text: `You are TrueLens v2.0, a highly precise AI forensic image analyst. Your goal is to determine if an image is an authentic photograph or AI-generated (Deepfake).
            
            CRITICAL INSTRUCTION: You must be balanced. Do not assume every image is a deepfake. Authentic photos often have noise, blur, or compression that can look like artifacts.
            
            FORENSIC CRITERIA:
            1. Diffusion Artifacts: Look for nonsensical textures, "melting" details, or inconsistent repeating patterns.
            2. Pixel Consistency: Authentic images have a uniform sensor noise floor. AI often has patchy or perfectly clean areas.
            3. Anatomical Integrity: Check for eye reflection mismatches, nonsensical ear geometry, or unnatural skin-to-hair transitions.
            4. Physics: Check if shadows and highlights align with a single light source.
            5. Textual Artifacts: AI often struggles with readable text in the background (gibberish, distorted letters).
            
            FALSE POSITIVE MITIGATION:
            - Heavy editing (Photoshop, Lightroom) is NOT the same as AI generation.
            - Low-light noise and JPEG compression are NOT AI artifacts.
            - If an image is just "bad quality", it is likely "Safe" or "Suspicious", not "High-Risk".
            
            THINKING PROCESS:
            1. Identify all artifacts.
            2. Determine if they are typical of camera sensors/lenses or AI generation.
            3. Weigh the evidence. One minor artifact does not make a deepfake.
            
            OUTPUT REQUIREMENTS:
            - verdict: "Safe" (Authentic), "Suspicious" (Ambiguous/Heavily Edited), or "High-Risk" (AI-Generated).
            - riskScore: A value from 0-100 representing the probability that the image is AI-GENERATED or MANIPULATED.
              * 0-30: Likely Authentic (Safe)
              * 31-70: Ambiguous or Heavily Modified (Suspicious)
              * 71-100: Likely AI-Generated (High-Risk)
            - isFake: Set to true ONLY if the image is likely AI-generated (verdict is High-Risk).
            - forensicPoints: Exactly 5 coordinates (0-100) of specific areas supporting your verdict.`,
          },
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isFake: { type: Type.BOOLEAN },
          riskScore: { type: Type.NUMBER },
          analysis: { type: Type.STRING },
          artifacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          verdict: { type: Type.STRING, enum: ["Safe", "Suspicious", "High-Risk"] },
          forensicPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                intensity: { type: Type.NUMBER },
              },
              required: ["x", "y", "label", "intensity"],
            },
          },
        },
        required: ["isFake", "riskScore", "analysis", "artifacts", "verdict", "forensicPoints"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeText(text: string): Promise<TextAnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `You are a fact-checking expert. Analyze the provided text for misinformation or AI-generated propaganda.
            
            OUTPUT REQUIREMENTS:
            - verdict: "Safe", "Suspicious", or "High-Risk".
            - riskScore: 0-100 (0 = highly reliable/authentic, 100 = blatant misinformation/AI-generated).
            - isReliable: true if riskScore < 30.
            - nextSteps: Actionable verification steps.`,
          },
          { text: text },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isReliable: { type: Type.BOOLEAN },
          riskScore: { type: Type.NUMBER },
          analysis: { type: Type.STRING },
          flags: { type: Type.ARRAY, items: { type: Type.STRING } },
          verdict: { type: Type.STRING, enum: ["Safe", "Suspicious", "High-Risk"] },
          nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["isReliable", "riskScore", "analysis", "flags", "verdict", "nextSteps"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
