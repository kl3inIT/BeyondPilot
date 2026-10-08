import { cn } from "cn";

/**
 * The aurora behind the landing hero (Figma "Aurora"): three heavily blurred ellipses, azure,
 * lilac and peach, that fade in on load. On phones they hug the right edge so the light enters
 * from it; from `lg` they take the desktop offsets of the 1440 frame.
 */
function Glow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      {...props}
    >
      <div className="absolute -top-24 -right-32 h-80 w-96 animate-in rounded-[50%] bg-aurora-azure blur-[60px] ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none lg:-top-48 lg:right-auto lg:left-180 lg:h-155 lg:w-190" />
      <div className="absolute top-24 -right-24 h-72 w-72 animate-in rounded-[50%] bg-aurora-violet blur-[55px] delay-200 ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none lg:top-22 lg:right-auto lg:left-245 lg:h-130 lg:w-140" />
      <div className="absolute top-72 -right-20 h-60 w-72 animate-in rounded-[50%] bg-aurora-peach blur-[50px] delay-400 ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none lg:top-87 lg:right-auto lg:left-205 lg:h-105 lg:w-120" />
    </div>
  );
}

export { Glow };
