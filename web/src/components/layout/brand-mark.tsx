import Image from "next/image";

/**
 * BeyondPilot's icon from the approved kit: the white B on the purple tile, in its small-size form
 * without the GenAI Fund accent, which the kit asks for wherever the icon is drawn small. The tile
 * carries its own background, so it reads by day and at night. Decorative wherever the name stands
 * beside it. It loads at once: it heads every page, and a lazy image inside the collapsed admin
 * sidebar was never fetched there.
 */
function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/beyondpilot-icon.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      loading="eager"
      className={className}
    />
  );
}

export { BrandMark };
