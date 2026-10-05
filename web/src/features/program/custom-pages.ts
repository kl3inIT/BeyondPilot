import type { ComponentType } from "react";

import type { Program } from "@/lib/api/generated";

import { TascoPage } from "./tasco/tasco-page";

/**
 * The pages written for one program, by its address. Their content lives here in both languages;
 * the program's dates, events and application window still come from what the operator entered.
 */
export const customProgramPages: Partial<Record<string, ComponentType<{ program: Program }>>> = {
  "insurance-ai-tasco": TascoPage,
};
