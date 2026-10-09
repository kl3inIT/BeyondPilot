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
  priceFromCatalog: true,
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
      pricePerThousandCalls: 1.5,
      priceFromCatalog: true,
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

// Admin > AI > Usage, with staging's figures of 9 October 2026: reading documents failed 93 times on one
// model. The last 30 days answer as a period without calls, for the empty state.
const usageGroups = {
  model: [
    ["aihay", "AI Hay", "document_reading", 957, 9, 0, 0, 3400, null],
    ["cx/gpt-6-luna", "9Router", "document_reading", 412, 93, 1100000, 70000, 3400, 0.14],
    ["cx/gpt-6.1-sol", "9Router", "matching", 207, 1, 1070000, 106000, 19400, null],
  ],
  task: [
    [null, null, "document_reading", 1369, 102, 1100000, 70000, 3400, 0.14],
    [null, null, "matching", 207, 1, 1070000, 106000, 19400, null],
  ],
  provider: [
    [null, "AI Hay", null, 957, 9, 0, 0, 3400, null],
    [null, "9Router", null, 619, 94, 2170000, 176000, 8750, 0.14],
  ],
};

const usageHours = [
  [36, 0],
  [152, 0],
  [148, 34],
  [188, 37],
  [170, 27],
  [245, 2],
  [228, 0],
  [136, 0],
  [72, 0],
  [56, 2],
  [34, 1],
  [8, 0],
];

function usageOverview(query) {
  const period = query.get("period") ?? "today";
  const by = query.get("by") ?? "model";
  if (period === "30d") {
    return {
      period,
      totals: {
        calls: 0,
        succeeded: 0,
        failed: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: null,
        pricedCalls: 0,
        unpricedCalls: 0,
      },
      failing: [],
      seriesStep: "day",
      series: [],
      by,
      breakdown: [],
    };
  }
  const byHour = period === "today";
  return {
    period,
    totals: {
      calls: 1576,
      succeeded: 1473,
      failed: 103,
      inputTokens: 2170000,
      outputTokens: 176000,
      estimatedCost: 0.14,
      pricedCalls: 319,
      unpricedCalls: 1154,
    },
    failing: [
      {
        task: "document_reading",
        providerName: "9Router",
        modelName: "cx/gpt-6-luna",
        calls: 412,
        failed: 93,
        lastFailedAt: "2026-10-09T07:24:00Z",
        lastFailure: "too_large",
      },
    ],
    seriesStep: byHour ? "hour" : "day",
    series: byHour
      ? usageHours.map(([succeeded, failed], index) => ({
          start: new Date(Date.UTC(2026, 9, 9, 3 + index)).toISOString(),
          succeeded,
          failed,
        }))
      : [0, 0, 0, 0, 0, 0, 1].map((today, index) => ({
          start: new Date(Date.UTC(2026, 9, 2 + index, 17)).toISOString(),
          succeeded: today ? 1473 : 0,
          failed: today ? 103 : 0,
        })),
    by,
    breakdown: usageGroups[by].map(
      ([
        modelName,
        providerName,
        task,
        calls,
        failed,
        inputTokens,
        outputTokens,
        averageDurationMs,
        estimatedCost,
      ]) => ({
        modelName,
        providerName,
        task,
        calls,
        failed,
        inputTokens,
        outputTokens,
        averageDurationMs,
        estimatedCost,
      }),
    ),
  };
}

const usageCall = (id, occurredAt, task, providerName, modelName, rest) => ({
  id: `c0000000-0000-4000-8000-00000000000${id}`,
  occurredAt,
  task,
  providerName,
  modelName,
  outcome: "ok",
  failure: null,
  errorStatus: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  durationMs: 3400,
  estimatedCost: null,
  subjectType: "solution_deck",
  subjectId: "5b1f2c3d-0000-4000-8000-0000000000aa",
  ...rest,
});

const usageLog = [
  usageCall(1, "2026-10-09T14:02:11Z", "document_reading", "AI Hay", "aihay", {
    estimatedCost: 0.0015,
  }),
  usageCall(2, "2026-10-09T13:40:02Z", "matching", "9Router", "cx/gpt-6.1-sol", {
    inputTokens: 5210,
    outputTokens: 512,
    durationMs: 19400,
    subjectType: "matching_run",
    subjectId: "7a000000-0000-4000-8000-000000000001",
  }),
  usageCall(3, "2026-10-09T07:24:00Z", "document_reading", "9Router", "cx/gpt-6-luna", {
    outcome: "failed",
    failure: "too_large",
    errorStatus: 413,
    durationMs: 800,
  }),
  usageCall(4, "2026-10-09T07:23:01Z", "document_reading", "9Router", "cx/gpt-6-luna", {
    outcome: "failed",
    failure: "failed",
    durationMs: 900,
  }),
];

function usageCalls(query) {
  const kept = usageLog.filter(
    (call) =>
      (!query.get("outcome") || call.outcome === query.get("outcome")) &&
      (!query.get("task") || call.task === query.get("task")) &&
      (!query.get("model") || call.modelName === query.get("model")) &&
      (!query.get("provider") || call.providerName === query.get("provider")),
  );
  return {
    items: kept,
    page: 1,
    pageSize: 50,
    total: kept.length,
    tasks: ["document_reading", "matching"],
    providers: ["9Router", "AI Hay"],
    models: ["aihay", "cx/gpt-6-luna", "cx/gpt-6.1-sol"],
  };
}

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
  if (url.pathname === "/api/ai/admin/usage/overview") {
    return [200, usageOverview(url.searchParams)];
  }
  if (url.pathname === "/api/ai/admin/usage/calls") {
    return [200, usageCalls(url.searchParams)];
  }
  return url.pathname === "/api/ai/admin/chat" ? [200, chatSettings] : [404, {}];
}
