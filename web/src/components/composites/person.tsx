import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";

type PersonProps = React.ComponentProps<"div"> & {
  /** Null until the person or their provider gives a name; the address then takes the first line. */
  name: string | null;
  email: string;
  /** Shown after the name, for example a "You" badge. */
  badge?: React.ReactNode;
  /**
   * Reads quieter, for a person whose account is switched off. Only the name is quieter: dimming the
   * initials takes them below the contrast a reader needs.
   */
  muted?: boolean;
};

/** A person in a row or a card: their initials, then the name over the address. */
function Person({ name, email, badge, muted = false, className, ...props }: PersonProps) {
  return (
    <div data-slot="person" className={cn("flex min-w-0 items-center gap-3", className)} {...props}>
      <Avatar>
        <AvatarFallback>{initials(name, email)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium", muted && "text-muted-foreground")}>
            {name ?? email}
          </span>
          {badge}
        </span>
        {name && <span className="truncate text-muted-foreground">{email}</span>}
      </div>
    </div>
  );
}

export { Person };
