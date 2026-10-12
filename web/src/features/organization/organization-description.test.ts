import { describe, expect, it } from "vitest";

import { descriptionLine, shownDescription } from "./organization-description";

describe("shownDescription", () => {
  it("leaves a description a person wrote as it is", () => {
    const written =
      "VeriPura is a fintech infrastructure platform for global food trade. It validates compliance documents with AI.";
    expect(shownDescription(written)).toEqual({ text: written, items: [] });
    expect(shownDescription("Route planning for fleets")).toEqual({
      text: "Route planning for fleets",
      items: [],
    });
  });

  it("lists what the old platform joined, under the sentence that introduces it", () => {
    expect(
      shownDescription(
        "Company founded in 2021, focusing on: Vision AI – image or video recognition ||| Voice AI – speech-to-text, voice agents ||| Data & Analytics",
      ),
    ).toEqual({
      text: "Company founded in 2021, focusing on:",
      items: [
        "Vision AI – image or video recognition",
        "Voice AI – speech-to-text, voice agents",
        "Data & Analytics",
      ],
    });
  });

  it("drops the item the cut fell in", () => {
    expect(
      shownDescription(
        "Company founded in 2024, focusing on: Core GenAI Technology – LLMs, fine-tuning, RAG ||| AI for Workflow & Productivity – Copilots, task automation, knowledge workers ||| Agentic AI / Autonomous Agents – AI agents that au…",
      ),
    ).toEqual({
      text: "Company founded in 2024, focusing on:",
      items: [
        "Core GenAI Technology – LLMs, fine-tuning, RAG",
        "AI for Workflow & Productivity – Copilots, task automation, knowledge workers",
      ],
    });
  });

  it("writes one item left as the end of its sentence, not as a list of one", () => {
    expect(
      shownDescription(
        "Company founded in 2020, focusing on: AI for Workflow & Productivity – Copilots, task automation, knowledge workers ||| Agentic AI / Autonomous Agents – AI agents that au…",
      ),
    ).toEqual({
      text: "Company founded in 2020, focusing on: AI for Workflow & Productivity – Copilots, task automation, knowledge workers.",
      items: [],
    });
  });

  it("ends a cut paragraph at its last whole sentence", () => {
    expect(
      shownDescription(
        "CX Genie Inc. is the customer support platform for teams in the U.S. and Vietnam, with custom chatbots and ticket management. AI is reshaping customer support by enabling 24/7 multilingual automation, reducing costs, and enhan...",
      ),
    ).toEqual({
      text: "CX Genie Inc. is the customer support platform for teams in the U.S. and Vietnam, with custom chatbots and ticket management.",
      items: [],
    });
  });

  it("keeps the whole words of a paragraph cut before its first sentence ended", () => {
    expect(
      shownDescription(
        "We create custom solutions for brands and agencies, with a division for GenAI called madebymachines that bui…",
      ),
    ).toEqual({
      text: "We create custom solutions for brands and agencies, with a division for GenAI called madebymachines that…",
      items: [],
    });
  });

  it("lists items that nothing introduces, and tidies the spaces between them", () => {
    expect(shownDescription("  Chatbots |||  Document\n processing ;||| ")).toEqual({
      text: "",
      items: ["Chatbots", "Document processing"],
    });
  });

  it("shows nothing for a description that is missing or holds only a cut", () => {
    expect(shownDescription(null)).toEqual({ text: "", items: [] });
    expect(shownDescription(" … ")).toEqual({ text: "", items: [] });
    expect(shownDescription("Company founded in 2022, focusing on: ||| Agen…")).toEqual({
      text: "",
      items: [],
    });
  });
});

describe("descriptionLine", () => {
  it("writes the list on one line", () => {
    expect(
      descriptionLine("Company founded in 2021, focusing on: Vision AI ||| Voice AI ||| Robot…"),
    ).toBe("Company founded in 2021, focusing on: Vision AI; Voice AI.");
    expect(descriptionLine("Route planning for fleets.")).toBe("Route planning for fleets.");
  });
});
