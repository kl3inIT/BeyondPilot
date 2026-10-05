import { initials } from "@/lib/initials";

/** Stands where an organization's logo goes: its initials in a rounded square. */
function OrganizationMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground"
    >
      {initials(name, name)}
    </span>
  );
}

export { OrganizationMark };
