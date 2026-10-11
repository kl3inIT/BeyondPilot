type OrganizationSectionProps = {
  /** The id of the heading, which names the section. */
  id: string;
  title: string;
  /** What the section holds, in a few words beside its title: "3 members · 1 invitation pending". */
  summary?: string;
  /** The one action that adds to the section. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** One titled part of a My organization page: its heading, what it holds, and its main action. */
function OrganizationSection({ id, title, summary, action, children }: OrganizationSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      {/* On a phone the title and the action share a line, and the summary takes the next one. */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={id} className="flex-1 text-lg font-semibold md:flex-none">
          {title}
        </h2>
        <span className="order-last basis-full text-sm font-medium text-muted-foreground empty:hidden md:order-none md:flex-1 md:basis-0 md:empty:block">
          {summary}
        </span>
        {action}
      </div>
      {children}
    </section>
  );
}

export { OrganizationSection };
