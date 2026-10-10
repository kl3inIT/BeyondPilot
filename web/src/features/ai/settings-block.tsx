/**
 * One block of an Admin › AI screen: what it is for on the left from 1024px, its content on the
 * right. A lead is a line most people need; `help` is a "?" beside the title for what only some do.
 */
function SettingsBlock({
  id,
  title,
  lead,
  help,
  first,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  help?: React.ReactNode;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 lg:flex-row lg:gap-12 ${first ? "" : "border-t pt-8"}`}
    >
      <div className="flex flex-col gap-1 lg:w-65 lg:shrink-0">
        <div className="flex items-center gap-1">
          <h2 id={id} className="text-base font-medium">
            {title}
          </h2>
          {help}
        </div>
        {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

export { SettingsBlock };
