/**
 * The named motion values a library takes as numbers (docs/conventions.md › Motion). Every other
 * duration is a class of the named scale in `app/globals.css`; these are the same steps.
 */

/** How long a chart takes to draw, in milliseconds. */
export const chartDrawMs = 400;

/** `duration-base`, in seconds: what appears, leaves or changes state. */
export const baseSeconds = 0.2;

/** `ease-entrance`: a confident arrival that slows into place. */
export const entranceEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** How a counting figure moves: the `duration-slow` step for its digits, `duration-base` to fade. */
export const countingTiming = {
  transform: { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  spin: { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  opacity: { duration: 200, easing: "ease-out" },
} satisfies Record<string, EffectTiming>;
