import { cn } from "cn";

/**
 * The aurora behind the landing hero (Figma "Aurora"): three heavily blurred ellipses, azure,
 * lilac and peach, that fade in on load. They keep the desktop offsets on phones, so the light
 * enters from the right edge as in the 390 frame.
 */
function Glow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      {...props}
    >
      <div className="absolute -top-48 left-180 h-155 w-190 animate-in rounded-[50%] bg-aurora-azure blur-[60px] ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none" />
      <div className="absolute top-22 left-245 h-130 w-140 animate-in rounded-[50%] bg-aurora-violet blur-[55px] delay-200 ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none" />
      <div className="absolute top-87 left-205 h-105 w-120 animate-in rounded-[50%] bg-aurora-peach blur-[50px] delay-400 ease-entrance animation-duration-1600 fill-mode-both fade-in motion-reduce:animate-none" />
    </div>
  );
}

export { Glow };
