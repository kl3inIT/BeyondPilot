"use client";

import { useId } from "react";
import { Area, AreaChart, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { chartDrawMs } from "@/lib/motion";

type SparklineProps = {
  /** One value a step, oldest first. */
  values: number[];
  /** A series nobody needs to act on, such as an empty queue: it is drawn in grey. */
  quiet?: boolean;
};

/**
 * The direction of one series beside its figure (docs/conventions.md › Charts): no axis, no tooltip,
 * the `monotone` curve so it never draws a value the data does not have. The figure and its period
 * are in the text beside it, so the drawing is hidden from assistive technology. Shown from 768px.
 */
function Sparkline({ values, quiet = false }: SparklineProps) {
  const config = {
    value: { label: "", color: quiet ? "var(--muted-foreground)" : "var(--primary)" },
  } satisfies ChartConfig;
  const data = values.map((value, step) => ({ step, value }));
  const fill = `sparkline-${useId().replace(/:/g, "")}`;

  return (
    <ChartContainer
      config={config}
      aria-hidden="true"
      className="hidden aspect-auto h-12 w-28 shrink-0 self-end md:flex"
    >
      {/* Not focusable: the figure beside it says what it shows. */}
      <AreaChart
        accessibilityLayer={false}
        data={data}
        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* The scale runs to at least 2: a queue of one is not drawn as a wall, a flat one not on the floor. */}
        <YAxis hide domain={[0, (most: number) => Math.max(most, 2)]} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill={`url(#${fill})`}
          baseValue={0}
          isAnimationActive
          animationDuration={chartDrawMs}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export { Sparkline };
