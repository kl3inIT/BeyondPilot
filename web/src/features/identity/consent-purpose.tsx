import { MailIcon, ShieldCheckIcon, SparklesIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import type { Purpose } from "./consent-choices";

/** What needs each purpose: the platform itself, submitting to a program, or nothing. */
const requiredFor = {
  platform: "platform",
  partners: "apply",
  ai: "none",
  updates: "none",
} as const satisfies Record<Purpose, string>;

const purposeIcons: Record<Purpose, LucideIcon> = {
  platform: ShieldCheckIcon,
  partners: UsersIcon,
  ai: SparklesIcon,
  updates: MailIcon,
};

/** Says whether a purpose is required, needed to apply, or optional. */
function PurposeBadge({ purpose }: { purpose: Purpose }) {
  const t = useTranslations("Consent.required");
  const need = requiredFor[purpose];
  return (
    <Badge variant={need === "platform" ? "brand" : need === "apply" ? "warning" : "outline"}>
      {t(need)}
    </Badge>
  );
}

export { PurposeBadge, purposeIcons };
