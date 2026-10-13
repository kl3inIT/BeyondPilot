import {
  BoxesIcon,
  BuildingIcon,
  CableIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  GiftIcon,
  HouseIcon,
  LightbulbIcon,
  MailIcon,
  MessageSquareWarningIcon,
  PlugZapIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The icon of each destination of the admin area. The sidebar and the title of the destination's page both read it
 * here, so the two always match.
 */
const adminIcons = {
  home: HouseIcon,
  programs: CalendarRangeIcon,
  useCases: LightbulbIcon,
  solutions: BoxesIcon,
  offers: GiftIcon,
  talent: UsersIcon,
  organizations: BuildingIcon,
  reportedMessages: MessageSquareWarningIcon,
  aiProviders: PlugZapIcon,
  searchIndex: ScanSearchIcon,
  aiMatching: SlidersHorizontalIcon,
  aiUsage: ChartColumnIcon,
  mcp: CableIcon,
  accounts: UserCogIcon,
  auditLog: ScrollTextIcon,
  email: MailIcon,
} satisfies Record<string, LucideIcon>;

type AdminDestination = keyof typeof adminIcons;

/**
 * The title of an admin page. A top-level page names its destination and its title comes after that destination's
 * icon, as the sidebar shows it, so the page and the highlighted item read as one place; on a narrow screen the bar
 * above the page already shows this title, so here it stays for assistive technology only. A page below a
 * destination has a plain title, which every width shows.
 */
function AdminPageTitle({
  destination,
  className,
  children,
}: {
  destination?: AdminDestination;
  className?: string;
  children: React.ReactNode;
}) {
  if (!destination) {
    return (
      <h1 className={cn("min-w-0 text-2xl font-semibold tracking-tight break-words", className)}>
        {children}
      </h1>
    );
  }

  const Icon = adminIcons[destination];
  return (
    <h1
      className={cn(
        "flex items-center gap-2.5 text-2xl font-semibold tracking-tight max-md:sr-only",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-6 shrink-0 text-muted-foreground"
      />
      {children}
    </h1>
  );
}

export { adminIcons, AdminPageTitle, type AdminDestination };
