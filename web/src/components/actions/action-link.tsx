import { Link } from "@/i18n/navigation";

type ActionLinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string };

/**
 * The anchor behind an action that navigates. App paths go through the locale-aware `Link`;
 * anything else (`https:`, `mailto:`) is a plain anchor. Navigation stays a link for assistive
 * technology instead of taking the button role.
 */
function ActionLink({ href, ...props }: ActionLinkProps) {
  if (href.startsWith("/")) {
    return <Link href={href} {...props} />;
  }
  return <a href={href} {...props} />;
}

export { ActionLink, type ActionLinkProps };
