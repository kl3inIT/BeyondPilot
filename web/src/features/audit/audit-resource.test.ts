import { describe, expect, it } from "vitest";

import { auditResourceRoute } from "./audit-resource";

const id = "0b9c3d1e-5a7f-4e2b-9c1d-3f6a8b2e4d10";

describe("auditResourceRoute", () => {
  it.each([
    ["organization", `/admin/organizations/${id}`],
    ["solution", `/admin/solutions/${id}`],
    ["solution_offer", `/admin/offers/${id}`],
    ["talent", `/admin/talent/${id}`],
    ["use_case", `/admin/use-cases/${id}`],
    ["program", `/admin/programs/${id}/settings`],
    ["email_message", `/admin/email/activity/${id}`],
  ])("leads a %s to its record", (type, route) => {
    expect(auditResourceRoute({ action: "x.update", resource: { type, id } })).toBe(route);
  });

  it("leads an email template to the kind it words", () => {
    expect(
      auditResourceRoute({
        action: "email.template_update",
        resource: { type: "email_template", id: "sign_in_code" },
      }),
    ).toBe("/admin/email/templates/sign_in_code");
  });

  it("leaves the wording of an email that is no longer sent as text", () => {
    expect(
      auditResourceRoute({
        action: "email.template_update",
        resource: { type: "email_template", id: "talent_enquiry" },
      }),
    ).toBeNull();
  });

  it.each([
    ["email_settings", "/admin/email/settings"],
    ["search_settings", "/admin/ai/search-index"],
    ["search_index", "/admin/ai/search-index"],
    ["matching_settings", "/admin/ai/matching"],
    ["mcp_settings", "/admin/ai/mcp"],
  ])("leads %s to the page that holds it", (type, route) => {
    expect(auditResourceRoute({ action: "x.change", resource: { type, id: "1" } })).toBe(route);
  });

  it.each([
    "account",
    "introduction",
    "talent_enquiry",
    "conversation",
    "customer_deployment",
    "email_address",
    "ai_provider",
    "ai_model",
    "ai_task",
    "mcp_app",
    "toString",
  ])("leaves a %s as text: the app has no page for it", (type) => {
    expect(auditResourceRoute({ action: "x.update", resource: { type, id } })).toBeNull();
  });

  it.each([
    ["talent.delete", "talent"],
    ["solution.offer_delete", "solution_offer"],
  ])("leaves the resource of %s as text: the record is gone", (action, type) => {
    expect(auditResourceRoute({ action, resource: { type, id } })).toBeNull();
  });
});
