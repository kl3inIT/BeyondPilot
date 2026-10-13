"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useLocale } from "next-intl";

import { countingTiming } from "@/lib/motion";

type CountingNumberProps = {
  value: number;
  /** How the number is written, as `Intl.NumberFormat` takes it. */
  format?: Format;
};

/**
 * A figure that counts to its new value when it changes in place, such as a total when its period
 * changes (docs/conventions.md › Motion), as Dub's figures do. It is written in the page's language;
 * assistive technology reads the whole value at once, and a person who asked for less motion sees it
 * change at once. A figure that is drawn once and never changes in place does not need it.
 */
function CountingNumber({ value, format }: CountingNumberProps) {
  const locale = useLocale();
  return (
    <NumberFlow
      value={value}
      locales={locale}
      format={format}
      transformTiming={countingTiming.transform}
      spinTiming={countingTiming.spin}
      opacityTiming={countingTiming.opacity}
      className="tabular-nums"
    />
  );
}

export { CountingNumber };
