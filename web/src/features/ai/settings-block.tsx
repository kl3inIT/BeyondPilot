/** One block of an Admin › AI screen: what it is for on the left from 768px, its content on the right. */
function SettingsBlock({
  id,
  title,
  lead,
  first,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 md:flex-row md:gap-12 ${first ? "" : "border-t pt-8"}`}
    >
      <div className="flex flex-col gap-1 md:w-65 md:shrink-0">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

export { SettingsBlock };
