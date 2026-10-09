// What GET /api/ai/admin/chat answers in the end-to-end tests: Claude in use for matching with three
// models, and a gateway on a private address with two. A key is never part of an answer.

const model = (id, modelName, contextWindow, maxOutputTokens, inputPrice, outputPrice) => ({
  id,
  modelName,
  displayName: modelName,
  contextWindow,
  maxOutputTokens,
  inputPrice,
  outputPrice,
  cachedInputPrice: null,
  toolCalling: true,
  vision: true,
  reasoning: true,
  version: 0,
});

const chatSettings = {
  keysCanBeStored: true,
  adapters: ["anthropic", "openai"],
  providers: [
    {
      id: "5d1c2b3a-0f9e-4d8c-8b7a-6f5e4d3c2b1a",
      adapterType: "anthropic",
      name: "Claude",
      baseUrl: "https://api.anthropic.com",
      enabled: true,
      hasKey: true,
      inUse: true,
      updatedBy: "Operator",
      updatedAt: "2026-10-08T09:00:00Z",
      version: 1,
      models: [
        model("a1000000-0000-4000-8000-000000000001", "claude-haiku-4-5", 200000, 64000, 1, 5),
        model("a1000000-0000-4000-8000-000000000002", "claude-opus-4-5", 200000, 32000, 5, 25),
        model("a1000000-0000-4000-8000-000000000003", "claude-sonnet-4-5", 200000, 64000, 3, 15),
      ],
    },
    {
      id: "6e2d3c4b-1a0f-4e9d-9c8b-7a6f5e4d3c2b",
      adapterType: "openai",
      name: "9Router",
      baseUrl: "http://10.0.0.12:20128/v1",
      enabled: true,
      hasKey: true,
      inUse: false,
      updatedBy: "Operator",
      updatedAt: "2026-10-08T09:05:00Z",
      version: 0,
      models: [
        model("b2000000-0000-4000-8000-000000000001", "gpt-5-mini", 272000, 128000, 0.25, 2),
        {
          ...model(
            "b2000000-0000-4000-8000-000000000002",
            "deepseek-chat",
            128000,
            null,
            null,
            null,
          ),
          reasoning: false,
          vision: false,
        },
      ],
    },
  ],
  tasks: [
    {
      task: "matching",
      modelId: "a1000000-0000-4000-8000-000000000003",
      reasoningEffort: "medium",
      available: true,
      version: 1,
    },
  ],
};

// What GET /api/ai/admin/ocr answers: AI Hay connected and reading documents in a model's place.
const ocrSettings = {
  keysCanBeStored: true,
  adapters: ["aihay"],
  providers: [
    {
      id: "0c700000-0000-4000-8000-000000000001",
      adapterType: "aihay",
      name: "AI Hay",
      baseUrl: "https://api.ai-hay.vn",
      enabled: true,
      hasKey: true,
      inUse: true,
      updatedBy: "Operator",
      updatedAt: "2026-10-09T03:00:00Z",
      version: 1,
    },
  ],
  reader: {
    modelId: null,
    reasoningEffort: "low",
    ocrProviderId: "0c700000-0000-4000-8000-000000000001",
    available: true,
    version: 2,
  },
};

/** The Chat and OCR tabs of Admin › AI, for an operator only, as the backend answers them. */
export function answerAiAdmin(url, account) {
  if (!url.pathname.startsWith("/api/ai/admin/")) {
    return null;
  }
  if (account?.role !== "operator") {
    return [account ? 403 : 401, { code: "IDENTITY_OPERATOR_REQUIRED" }];
  }
  if (url.pathname === "/api/ai/admin/ocr") {
    return [200, ocrSettings];
  }
  return url.pathname === "/api/ai/admin/chat" ? [200, chatSettings] : [404, {}];
}
