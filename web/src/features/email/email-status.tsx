import { useTranslations } from "next-intl";

import { Status } from "@/components/composites/status";
import type { EmailMessageSummary } from "@/lib/api/generated";

type EmailStatus = EmailMessageSummary["status"];

/** The tone of each state: green once it reached the mailbox, red when it never will. */
const tones = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  bounced: "destructive",
  complained: "warning",
  failed: "destructive",
  skipped: "neutral",
} as const satisfies Record<EmailStatus, React.ComponentProps<typeof Status>["tone"]>;

/** Where an email stands, as a dot and a word. */
function EmailStatusLabel({ status }: { status: EmailStatus }) {
  const t = useTranslations("Admin.email.status");
  return <Status tone={tones[status]}>{t(status)}</Status>;
}

export { EmailStatusLabel, type EmailStatus };
