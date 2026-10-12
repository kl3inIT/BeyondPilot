import type messages from "../../messages/en.json";

import type { formats } from "./formats";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
