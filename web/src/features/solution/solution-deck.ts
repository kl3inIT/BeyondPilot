import { useFormatter } from "next-intl";

/**
 * Where the deck of a solution is read. Anyone reads the deck of an approved solution; before that
 * the backend answers only the members of its organization and the operators.
 */
export function deckAddress(slug: string) {
  return `/api/solution/solutions/${slug}/deck`;
}

const megabyte = 1024 * 1024;

/** The size of a file as a person reads it: megabytes with one decimal, kilobytes below one. */
export function useFileSize(): (bytes: number) => string {
  const format = useFormatter();
  return (bytes) =>
    bytes >= megabyte
      ? format.number(bytes / megabyte, {
          style: "unit",
          unit: "megabyte",
          maximumFractionDigits: 1,
        })
      : format.number(Math.max(1, Math.round(bytes / 1024)), { style: "unit", unit: "kilobyte" });
}
