import { cn } from "cn";

import { useVocabulary } from "@/i18n/vocabulary";

/** What a person is in an organization, as a pill: an owner stands out, a member reads quieter. */
function MemberRole({ role }: { role: "owner" | "member" }) {
  const roleName = useVocabulary("memberRole");

  return (
    <span
      data-slot="member-role"
      className={cn(
        "inline-flex h-6 w-fit items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        role === "owner" ? "bg-peach text-peach-foreground" : "bg-sky text-sky-foreground",
      )}
    >
      {roleName(role)}
    </span>
  );
}

export { MemberRole };
