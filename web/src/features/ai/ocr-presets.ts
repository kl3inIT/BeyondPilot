/**
 * The OCR services the tab offers to connect. A preset fills in a name, where the service is
 * reached and what 1,000 calls cost in US dollars; the backend knows only the adapter. AI Hay lists
 * OCR at 40,500 VND per 1,000 calls, which is 1.50 US dollars at the rate its own prices use
 * (27,000 VND to the dollar, read from its price list on 9 October 2026).
 */
const ocrPresets = [
  {
    id: "aihay",
    name: "AI Hay",
    adapterType: "aihay",
    baseUrl: "https://api.ai-hay.vn",
    pricePerThousandCalls: 1.5,
  },
] as const;

type OcrPreset = (typeof ocrPresets)[number];

export { ocrPresets, type OcrPreset };
