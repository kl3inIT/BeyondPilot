import { cva, type VariantProps } from "class-variance-authority";

/**
 * A danger action that is text until the pointer is on it. The red reads on the page at 4.5:1, not
 * on its own tint, so by day the hovered text turns to the ink of a danger tint (`rose-foreground`),
 * as the tinted button's text always is; at night the red reads on its tint as it is.
 */
const dangerText =
  "text-destructive hover:bg-destructive/10 hover:text-rose-foreground dark:hover:text-destructive";

/** The approving action as text, by the same rule: on its own tint by day the green is `mint-foreground`. */
const successText =
  "text-success hover:bg-success/10 hover:text-mint-foreground dark:hover:text-success";

/**
 * Product action appearance by role, not by look: `prominence` says how important the action is,
 * `tone` whether it is destructive, or the approving one of a pair of decisions. Mirrors the Figma `Button` component set
 * (docs/guidelines/figma.md › Components): full pills, except the tertiary action's 6px corners
 * (DESIGN.md › Buttons). `hit-area` gives every action a 44px target on touch screens.
 *
 * A solid action darkens under the pointer (`primary-hover`, `destructive-hover`, `success-hover`
 * in tokens.css), so its ink reads at 4.5:1 or better there as at rest; the colour at 90% let the
 * page through and fell under it.
 */
const actionVariants = cva(
  "hit-area inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none aria-busy:opacity-70 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      tone: {
        default: "",
        danger: "",
        success: "",
      },
      prominence: {
        primary: "shadow-sm",
        secondary: "border-input bg-background shadow-sm",
        tertiary: "rounded-sm bg-transparent",
        internal: "",
        inverse: "shadow-sm",
      },
    },
    compoundVariants: [
      {
        tone: "default",
        prominence: "primary",
        class: "bg-primary text-primary-foreground hover:bg-primary-hover",
      },
      {
        tone: "default",
        prominence: "secondary",
        class: "text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30",
      },
      {
        tone: "default",
        prominence: "tertiary",
        class: "text-foreground hover:bg-accent hover:text-accent-foreground",
      },
      {
        tone: "default",
        prominence: "internal",
        class: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      {
        tone: "default",
        prominence: "inverse",
        class: "bg-foreground text-background hover:bg-foreground/90",
      },
      {
        tone: "danger",
        prominence: "primary",
        class: "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
      },
      {
        tone: "danger",
        prominence: "secondary",
        class: dangerText,
      },
      {
        tone: "danger",
        prominence: "tertiary",
        class: dangerText,
      },
      {
        tone: "danger",
        prominence: "internal",
        class: "bg-destructive/10 text-rose-foreground hover:bg-destructive/20",
      },
      {
        tone: "success",
        prominence: "primary",
        class: "bg-success text-success-foreground hover:bg-success-hover",
      },
      {
        tone: "success",
        prominence: "secondary",
        class: successText,
      },
      {
        tone: "success",
        prominence: "tertiary",
        class: successText,
      },
      {
        tone: "success",
        prominence: "internal",
        class: "bg-success/10 text-mint-foreground hover:bg-success/20 dark:text-success",
      },
    ],
    defaultVariants: {
      tone: "default",
      prominence: "primary",
    },
  },
);

type ActionVariantProps = VariantProps<typeof actionVariants>;
type ActionTone = NonNullable<ActionVariantProps["tone"]>;
type ActionProminence = NonNullable<ActionVariantProps["prominence"]>;
type ActionSize = "sm" | "md" | "lg";

export { actionVariants, type ActionProminence, type ActionSize, type ActionTone };
