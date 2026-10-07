import { cva, type VariantProps } from "class-variance-authority";

/**
 * Product action appearance by role, not by look: `prominence` says how important the action is,
 * `tone` whether it is destructive, or the approving one of a pair of decisions. Mirrors the Figma `Button` component set
 * (docs/guidelines/figma.md › Components): full pills, except the tertiary action's 6px corners
 * (DESIGN.md › Buttons). `hit-area` gives every action a 44px target on touch screens.
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
        class: "bg-primary text-primary-foreground hover:bg-primary/90",
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
        class: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      {
        tone: "danger",
        prominence: "secondary",
        class: "text-destructive hover:bg-destructive/10",
      },
      {
        tone: "danger",
        prominence: "tertiary",
        class: "text-destructive hover:bg-destructive/10",
      },
      {
        tone: "danger",
        prominence: "internal",
        class: "bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      {
        tone: "success",
        prominence: "primary",
        class: "bg-success text-success-foreground hover:bg-success/90",
      },
      {
        tone: "success",
        prominence: "secondary",
        class: "text-success hover:bg-success/10",
      },
      {
        tone: "success",
        prominence: "tertiary",
        class: "text-success hover:bg-success/10",
      },
      {
        tone: "success",
        prominence: "internal",
        class: "bg-success/10 text-success hover:bg-success/20",
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
