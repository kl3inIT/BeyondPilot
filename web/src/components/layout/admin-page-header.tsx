import { ArrowLeftIcon } from "lucide-react";

import { TextButton } from "@/components/actions/text-button";
import { AdminCrumb } from "@/components/layout/admin-crumb";
import { AdminPageTitle, type AdminDestination } from "@/components/layout/admin-icons";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  /** The page's one `h1`. */
  title: React.ReactNode;
  /** The sidebar destination of a top-level page, whose icon leads the title. A page below one leaves it out. */
  destination?: AdminDestination;
  /** The way back to the page above, for a page below a destination. */
  back?: { href: string; label: string };
  /** What stands before the title, such as an organization's mark. */
  media?: React.ReactNode;
  /** What the record is now, beside the title: a status, a badge. */
  badges?: React.ReactNode;
  /** The line under the title. */
  lead?: React.ReactNode;
  /** The page's actions, on the right; the primary one comes last. */
  actions?: React.ReactNode;
  /** What belongs to the head and sits under it: the tabs of the page. */
  children?: React.ReactNode;
};

/**
 * The top of every admin page, in one order: the way back, then the title with its lead on the left and the
 * actions on the right, then the tabs. The search and filters of a list follow it as `FilterToolbar`
 * (docs/conventions.md › Admin page frame). A page below a destination is named by its title in the breadcrumb
 * of the bar above, after its destination.
 */
function AdminPageHeader({
  title,
  destination,
  back,
  media,
  badges,
  lead,
  actions,
  children,
}: AdminPageHeaderProps) {
  // On a narrow screen the bar above shows a destination's title. With nothing else beside it the
  // row would be an empty gap there, so it leaves the layout and stays for assistive technology.
  const titleOnly = Boolean(destination) && !media && !badges && !lead && !actions;

  return (
    <header className={cn("flex flex-col gap-4", titleOnly && "max-md:contents")}>
      {!destination && typeof title === "string" && <AdminCrumb label={title} />}
      {back && (
        <TextButton href={back.href} className="self-start">
          <ArrowLeftIcon aria-hidden="true" />
          {back.label}
        </TextButton>
      )}
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
          titleOnly && "max-md:sr-only",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {media}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <AdminPageTitle destination={destination}>{title}</AdminPageTitle>
              {badges}
            </div>
            {lead && <div className="text-sm text-muted-foreground">{lead}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export { AdminPageHeader };
