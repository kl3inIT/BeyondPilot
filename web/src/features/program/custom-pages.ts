import type { ComponentType } from "react";

import type { Program } from "@/lib/api/generated";

import { NestlePage } from "./nestle/nestle-page";
import { TascoPage } from "./tasco/tasco-page";

/**
 * The pages written for one program, by its address. Their content lives here in both languages;
 * the program's dates, events and application window still come from what the operator entered.
 */
export const customProgramPages: Partial<
  Record<string, ComponentType<{ program: Program; askHref?: string }>>
> = {
  "insurance-ai-tasco": TascoPage,
  "nestle-vietnam-ai-reinvention": NestlePage,
};

/** The picture a link to a written page previews with when the program has no cover, 1200 × 630. */
export const customProgramShareImages: Partial<Record<string, string>> = {
  "nestle-vietnam-ai-reinvention": "/programs/nestle/share.jpg",
};
