// What the email administration reads in the end-to-end tests: Resend chosen but its key missing, so
// no email can leave; three emails of the last day; one suppressed address. The previews a browser
// asks for are answered by each test with page.route.

const hour = 60 * 60 * 1000;
const ago = (hours) => new Date(Date.now() - hours * hour).toISOString();

const settings = {
  provider: "resend",
  fromName: "BeyondPilot",
  fromAddress: "no-reply@beyondpilot.ai",
  replyTo: null,
  ready: false,
  encryptionReady: true,
  accentColor: "#0B1B2E",
  footer: "You receive this email because you have an account on BeyondPilot.",
  smtp: { host: null, port: null, security: "starttls", username: null, passwordSet: false },
  ses: {
    region: null,
    accessKeyId: null,
    secretAccessKeySet: false,
    configurationSet: null,
    eventsTopicArn: null,
    eventsUrl: "https://beyondpilot.vadan.app/api/notification/email/events/ses",
  },
  resend: {
    apiKeySet: false,
    webhookSecretSet: false,
    eventsUrl: "https://beyondpilot.vadan.app/api/notification/email/events/resend",
  },
  updatedBy: null,
  updatedAt: null,
  version: 0,
};

const template = (kind, group, subject, edited = false) => ({
  kind,
  group,
  subject,
  edited,
  updatedBy: edited ? "Hà Lê" : null,
  updatedAt: edited ? ago(30) : null,
});

const templates = [
  template("sign_in_code", "sign_in", "Your BeyondPilot sign-in code"),
  template(
    "organization_invitation",
    "organizations",
    "You are invited to {{organizationName}} on BeyondPilot",
  ),
  template("organization_approved", "organizations", "{{organizationName}} on BeyondPilot", true),
  template("application_received", "applications", "Application submitted: {{programName}}"),
  template(
    "introduction_request",
    "introductions",
    "A request for an introduction to {{solutionName}}",
  ),
  template("talent_approved", "talent", "Your BeyondPilot talent profile is approved"),
];

const approved = {
  kind: "organization_approved",
  group: "organizations",
  subject: "{{organizationName}} on BeyondPilot",
  body: "# {{organizationName}} is approved\n\nGenAI Fund approved {{organizationName}} on BeyondPilot. Sign in to manage it.",
  defaultSubject: "{{organizationName}} on BeyondPilot",
  defaultBody:
    "# {{organizationName}} is approved\n\nGenAI Fund approved {{organizationName}} on BeyondPilot.",
  edited: true,
  updatedBy: "Hà Lê",
  updatedAt: ago(30),
  version: 2,
  variables: [{ name: "organizationName", required: true, sample: "Plain Cover" }],
};

const message = (id, hours, recipient, kind, subject, status) => ({
  id,
  createdAt: ago(hours),
  recipient,
  kind,
  subject,
  status,
  attempts: status === "queued" ? 0 : 1,
  lastError: null,
});

const messages = [
  message(
    "0a7d3c52-1e0e-4a53-9a55-0d3f6f6b7e01",
    1,
    "minh.tran@pocketpolicy.example",
    "organization_approved",
    "Pocket Policy on BeyondPilot",
    "delivered",
  ),
  message(
    "0a7d3c52-1e0e-4a53-9a55-0d3f6f6b7e02",
    3,
    "bounced@nowhere.example",
    "organization_invitation",
    "You are invited to Plain Cover on BeyondPilot",
    "bounced",
  ),
  message(
    "0a7d3c52-1e0e-4a53-9a55-0d3f6f6b7e03",
    5,
    "siti@plaincover.example",
    "application_received",
    "Application submitted: AI for Insurance Challenge × Tasco",
    "sent",
  ),
];

const html = (title) =>
  `<!doctype html><html><body style="font-family:sans-serif;padding:24px"><h1>${title}</h1><p>GenAI Fund approved it.</p></body></html>`;

const suppressions = [
  {
    address: "bounced@nowhere.example",
    reason: "bounce",
    createdAt: ago(3),
    createdBy: null,
    messageId: messages[1].id,
    messageKind: "organization_invitation",
  },
];

/** The answer to an email administration read, or undefined when the address is not one. */
export function answerEmail(url, account) {
  if (!url.pathname.startsWith("/api/notification/admin/email")) {
    return undefined;
  }
  if (account?.role !== "operator") {
    return [account ? 403 : 401, {}];
  }
  const path = url.pathname.slice("/api/notification/admin/email".length);
  if (path === "/settings") {
    return [200, settings];
  }
  if (path === "/templates") {
    return [200, { items: templates }];
  }
  if (path.startsWith("/templates/")) {
    return path === "/templates/organization_approved" ? [200, approved] : [404, {}];
  }
  if (path === "/messages") {
    const status = url.searchParams.get("status");
    const text = (url.searchParams.get("q") ?? "").toLowerCase();
    const items = messages.filter(
      (item) =>
        (!status || item.status === status) &&
        (!text || item.recipient.includes(text) || item.subject.toLowerCase().includes(text)),
    );
    return [
      200,
      {
        items,
        newer: null,
        older: null,
        counts: { total: 3, delivered: 1, sent: 1, bounced: 1, complained: 0, notSent: 0 },
      },
    ];
  }
  if (path.startsWith("/messages/")) {
    const found = messages.find((item) => item.id === path.split("/")[2]);
    if (!found) {
      return [404, {}];
    }
    const bounced = found.status === "bounced";
    return [
      200,
      {
        ...found,
        html: html(found.subject),
        text: found.subject,
        provider: "resend",
        providerMessageId: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
        sentAt: found.createdAt,
        resendable: !bounced,
        suppression: bounced ? suppressions[0] : null,
        events: bounced
          ? [
              {
                type: "bounced",
                occurredAt: found.createdAt,
                detail: "550 5.1.1 The email account does not exist",
              },
            ]
          : found.status === "delivered"
            ? [{ type: "delivered", occurredAt: found.createdAt, detail: null }]
            : [],
      },
    ];
  }
  if (path === "/suppressions") {
    return [200, { items: suppressions, page: 1, pageSize: 25, total: suppressions.length }];
  }
  return [404, {}];
}
