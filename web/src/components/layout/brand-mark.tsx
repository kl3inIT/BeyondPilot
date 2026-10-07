import Image from "next/image";

/**
 * BeyondPilot's mark: a paper wing climbing to the upper right, in the brand's two blues. It reads on light and dark
 * backgrounds alike, so it needs no tile behind it. Decorative wherever the name stands beside it.
 */
function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/beyondpilot-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}

export { BrandMark };
