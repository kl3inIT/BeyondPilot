import type { MessageKey } from "@/hooks/use-notify";
import type { EmailTest } from "@/lib/api/generated";

/** Why a test email did not leave, in the words of the toast that says so. */
export const testFailures: Record<NonNullable<EmailTest["failure"]>, MessageKey> = {
  not_configured: "Admin.email.test.notConfigured",
  authentication: "Admin.email.test.authentication",
  throttled: "Admin.email.test.throttled",
  unavailable: "Admin.email.test.unavailable",
  rejected: "Admin.email.test.rejected",
  invalid_recipient: "Admin.email.test.invalidRecipient",
};

/** Why the backend refused to send a test at all, by the problem's code. */
export const testRefusals: Partial<Record<string, MessageKey>> = {
  NOTIFICATION_TEST_RECIPIENT_INVALID: "Admin.email.test.recipientInvalid",
  NOTIFICATION_ADDRESS_SUPPRESSED: "Admin.email.test.suppressed",
  NOTIFICATION_TEST_LIMIT_REACHED: "Admin.email.test.limitReached",
};
