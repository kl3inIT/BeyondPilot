import { getChatSettings, type ChatSettings } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** The chat providers with their models and the model each task uses, for the operator behind this request. Server only. */
export async function readChatSettings(): Promise<ChatSettings> {
  const { data } = await getChatSettings(await sessionRequest());
  return data;
}
