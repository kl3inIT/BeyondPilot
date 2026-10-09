/**
 * The OCR services the tab offers to connect. A preset fills in a name and where the service is
 * reached; the backend knows only the adapter.
 */
const ocrPresets = [
  { id: "aihay", name: "AI Hay", adapterType: "aihay", baseUrl: "https://api.ai-hay.vn" },
] as const;

type OcrPreset = (typeof ocrPresets)[number];

export { ocrPresets, type OcrPreset };
