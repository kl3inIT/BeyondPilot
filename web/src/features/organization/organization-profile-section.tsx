import type { LucideIcon } from "lucide-react";

type OrganizationProfileSectionProps = {
  icon: LucideIcon;
  title: string;
  /** Under the title, while the section is being filled in: what the group is about. */
  lead?: string;
  children: React.ReactNode;
};

/**
 * A group of related profile facts on a tinted panel. The form and the read view share it, so a
 * profile keeps its shape between reading and editing.
 */
function OrganizationProfileSection({
  icon: Icon,
  title,
  lead,
  children,
}: OrganizationProfileSectionProps) {
  return (
    <section className="flex flex-col gap-6 rounded-2xl border bg-muted p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

export { OrganizationProfileSection };
