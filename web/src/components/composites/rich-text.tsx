import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";

import { cn } from "@/lib/utils";

/**
 * A long text an operator or a host wrote, such as a program's description: Markdown as Luma keeps
 * it, with bold, headings, lists and links, and a plain text whose line breaks are kept as typed.
 * Raw HTML in it is shown as text, never run, a link opens in a new tab, and an image is left out:
 * the page shows its own cover.
 */
function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 leading-relaxed text-muted-foreground",
        "[&_h1]:mt-3 [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5",
        "[&_li]:pl-1 [&_li>p]:inline",
        "[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_hr]:my-2",
        "[&_p:first-child]:mt-0 [&_p:has(>strong:only-child)]:mt-3",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export { RichText };
