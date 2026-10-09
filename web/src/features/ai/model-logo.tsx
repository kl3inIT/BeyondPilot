import { cn } from "cn";
import { BotIcon } from "lucide-react";
import Image from "next/image";

import { ClaudeLogo, GeminiLogo, OpenAILogo } from "@/components/assistant-ui/elements/logos";

import { modelVendor, vendorFiles } from "./model-vendor";

/**
 * The mark of the vendor that makes a model, read from its name, as MemoryOS shows it: a model
 * served by a gateway such as 9Router still shows who made it. Display only; the name alone
 * selects the model.
 */
function ModelLogo({ modelName, className }: { modelName: string; className?: string }) {
  const vendor = modelVendor(modelName);
  const size = cn("size-4 shrink-0", className);
  if (vendor === "openai") {
    return <OpenAILogo className={size} />;
  }
  if (vendor === "claude") {
    return <ClaudeLogo className={size} />;
  }
  if (vendor === "gemini") {
    return <GeminiLogo className={size} />;
  }
  if (vendor) {
    const { file, monochrome } = vendorFiles[vendor];
    return (
      <Image
        src={`/model-logos/${file}`}
        alt=""
        width={16}
        height={16}
        unoptimized
        className={cn(size, "object-contain", monochrome && "dark:invert")}
      />
    );
  }
  return <BotIcon aria-hidden="true" className={size} />;
}

export { ModelLogo };
