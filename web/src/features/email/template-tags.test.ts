import { describe, expect, it } from "vitest";

import { switchVariables, tagFaults } from "./template-tags";

const invitation =
  "{{inviterName}} invited you to {{#owner}}own{{/owner}}{{^owner}}join{{/owner}} {{organizationName}}.\n\n[Open]({{organizationUrl}})";
const enquiry =
  "{{#senderName}}{{senderName}}{{/senderName}}{{^senderName}}Someone{{/senderName}} wrote, {{#aboutProject}}about a project{{/aboutProject}}{{#aboutRole}}about a role{{/aboutRole}}.";

describe("switchVariables", () => {
  it("names what the default wording only shows or hides text with", () => {
    expect([
      ...switchVariables(
        ["organizationName", "inviterName", "owner", "organizationUrl"],
        "You are invited to {{organizationName}}",
        invitation,
      ),
    ]).toEqual(["owner"]);
  });

  it("leaves out a value that is printed inside the piece it shows", () => {
    expect([
      ...switchVariables(["senderName", "aboutProject", "aboutRole", "aboutOther"], "", enquiry),
    ]).toEqual(["aboutProject", "aboutRole"]);
  });

  it("names nothing the kind does not offer, and nothing without a default wording", () => {
    expect(switchVariables(["code"], "", "{{#other}}x{{/other}} {{code}}").size).toBe(0);
    expect(switchVariables(["owner"]).size).toBe(0);
  });
});

describe("tagFaults", () => {
  it("finds nothing wrong in wording that is written correctly", () => {
    expect(tagFaults(invitation)).toEqual([]);
    expect(tagFaults(enquiry)).toEqual([]);
    expect(tagFaults("No tag at all, and a lone { or }.")).toEqual([]);
  });

  it("finds a tag that is never closed, with its line", () => {
    expect(tagFaults("Hello\n\nDear {{name, welcome to {{team}}.")).toEqual([
      { kind: "unclosed", from: 12, to: 14, line: 3 },
    ]);
    expect(tagFaults("Dear {{name")).toEqual([{ kind: "unclosed", from: 5, to: 7, line: 1 }]);
  });

  it("finds a kind of tag templates may not use", () => {
    expect(tagFaults("{{{name}}} and {{> footer}}")).toEqual([
      { kind: "forbidden", from: 0, to: 3, line: 1, tag: "{{{" },
      { kind: "forbidden", from: 15, to: 18, line: 1, tag: "{{>" },
    ]);
  });

  it("finds a condition that starts and never ends", () => {
    expect(tagFaults("to {{#owner}}own {{organizationName}}")).toEqual([
      { kind: "unended", from: 3, to: 13, line: 1, name: "owner" },
    ]);
    // One left open inside another that is closed.
    expect(tagFaults("{{#claim}}a {{^owner}}b{{/claim}}")).toEqual([
      { kind: "unended", from: 12, to: 22, line: 1, name: "owner" },
    ]);
  });

  it("finds a condition that ends and never started", () => {
    expect(tagFaults("own{{/owner}}")).toEqual([
      { kind: "unopened", from: 3, to: 13, line: 1, name: "owner" },
    ]);
  });
});
