import { describe, expect, it } from "vitest";

import { usageNumbers } from "./usage-format";

const numbers = usageNumbers({
  number: (value, options) => new Intl.NumberFormat("en", options).format(value),
});

describe("usageNumbers", () => {
  it.each([
    [0, "0"],
    [512, "512"],
    [5210, "5.21K"],
    [509_600, "509.6K"],
    [441_884, "441.88K"],
    [2_170_000, "2.17M"],
  ])("writes %d tokens as %s", (value, text) => {
    expect(numbers.tokens(value)).toBe(text);
  });

  it.each([
    [0, "$0.00"],
    [0.0015, "$0.0015"],
    [0.00004, "$0.00"],
    [0.14, "$0.14"],
    [0.999, "$0.999"],
    [1.2345, "$1.23"],
    [1234.5, "$1,234.50"],
  ])("writes a cost of %d as %s", (value, text) => {
    expect(numbers.cost(value)).toBe(text);
  });

  it.each([
    [800, "0.8"],
    [3400, "3.4"],
    [19_449, "19.4"],
    [60_000, "60"],
  ])("writes %d ms as %s seconds", (value, text) => {
    expect(numbers.seconds(value)).toBe(text);
  });
});
