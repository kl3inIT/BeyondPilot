import {
  BoxesIcon,
  BuildingIcon,
  CalendarRangeIcon,
  HandshakeIcon,
  HouseIcon,
  LightbulbIcon,
  MailIcon,
  PlugZapIcon,
  ScanSearchIcon,
  ScrollTextIcon,
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
  talent: UsersIcon,
  organizations: BuildingIcon,
  introductions: HandshakeIcon,
  aiProviders: PlugZapIcon,
  searchIndex: ScanSearchIcon,
  accounts: UserCogIcon,
  auditLog: ScrollTextIcon,
  email: MailIcon,
} satisfies Record<string, LucideIcon>;

type AdminDestination = keyof typeof adminIcons;

/**
 * The title of a top-level admin page, after its destination's icon as the sidebar shows it, so the page and the
 * highlighted item read as one place. A page below a destination keeps a plain title and its way back.
 */
function AdminPageTitle({
  destination,
  className,
  children,
}: {
  destination: AdminDestination;
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = adminIcons[destination];
  return (
    <h1
      className={cn("flex items-center gap-2.5 text-2xl font-semibold tracking-tight", className)}
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
