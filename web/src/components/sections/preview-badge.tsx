import { EyeIcon } from "lucide-react";

/** Marks a drawing of the product as a preview, wherever the landing shows one. */
function PreviewBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-primary">
      <EyeIcon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

export { PreviewBadge };
