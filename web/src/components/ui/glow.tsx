import { cn } from "cn";

/**
 * The sky light behind the landing hero (Figma "Glow/Azure" and "Glow/Cyan"): two heavily blurred
 * ellipses that fade in on load. On phones they keep the desktop offsets, so the light enters from
 * the right edge as in the 390 frame; from `lg` they centre on the search.
 */
function Glow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...props}
    >
      <div className="absolute top-[230px] left-[230px] h-[420px] w-[980px] animate-in rounded-[50%] bg-brand opacity-35 blur-[180px] ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none lg:left-1/2 lg:-translate-x-1/2" />
      <div className="absolute top-[330px] left-[560px] h-[300px] w-[620px] animate-in rounded-[50%] bg-primary opacity-22 blur-[140px] delay-200 ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none lg:left-[calc(50%-212px)] desktop:left-[calc(50%-160px)]" />
    </div>
  );
}

export { Glow };
