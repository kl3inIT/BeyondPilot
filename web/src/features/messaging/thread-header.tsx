import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/actions/icon-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";

import type { ConversationKind } from "./messaging-search";

type ThreadHeaderProps = {
  /** Who the conversation is with; null where the reader may not write, and the header says so. */
  name: string | null;
  /** What it is about: the kind, and the profile, solution or program by name. */
  about?: { kind: ConversationKind; name: string };
  /** Returns to the list, on a screen where the list and the conversation take turns. */
  onBack: () => void;
  /** The heading, which takes the focus when a conversation the reader may not write in opens. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** What the reader may open from here, at the end of the header. */
  children?: React.ReactNode;
};

/**
 * The head of the middle column, for a conversation and for a first message alike: the way back
 * to the list, who it is with, and what it is about.
 */
function ThreadHeader({ name, about, onBack, headingRef, children }: ThreadHeaderProps) {
  const t = useTranslations("Messaging");

  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
      <IconButton
        prominence="tertiary"
        size="sm"
        className="lg:hidden"
        aria-label={t("thread.back")}
        onClick={onBack}
      >
        <ArrowLeftIcon aria-hidden="true" />
      </IconButton>
      {name && (
        <Avatar>
          <AvatarFallback>{initials(name, name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="grid min-w-0 flex-1 text-sm">
        <h2 ref={headingRef} tabIndex={-1} className="truncate font-medium outline-none">
          {name ?? t("first.refusedTitle")}
        </h2>
        {about && (
          <p className="truncate text-muted-foreground">
            {[t(`kind.${about.kind}`), about.name].filter((part) => part !== name).join(" · ")}
          </p>
        )}
      </div>
      {children}
    </header>
  );
}

export { ThreadHeader };
