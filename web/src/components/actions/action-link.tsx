import { Link } from "@/i18n/navigation";

type ActionLinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string };

/** Paths the backend serves (next.config.ts); they have no locale and are full page loads. */
const backendPaths = ["/api/", "/login/", "/logout", "/oauth2/", "/ott/"];

/**
 * The anchor behind an action that navigates. App paths go through the locale-aware `Link`;
 * anything else (`https:`, `mailto:`, a backend path) is a plain anchor. Navigation stays a link
 * for assistive technology instead of taking the button role.
 */
function ActionLink({ href, ...props }: ActionLinkProps) {
  if (href.startsWith("/") && !backendPaths.some((path) => href.startsWith(path))) {
    return <Link href={href} {...props} />;
  }
  return <a href={href} {...props} />;
}

export { ActionLink, type ActionLinkProps };
