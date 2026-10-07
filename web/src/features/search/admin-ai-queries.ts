import {
  getSearchIndex,
  listAiProviders,
  type AiProviders,
  type SearchIndex,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** The embedding providers and the model in use, for the operator behind this request. Server only. */
export async function readAiProviders(): Promise<AiProviders> {
  const { data } = await listAiProviders(await sessionRequest());
  return data;
}

/** The state of the search index and of semantic search. Server only. */
export async function readSearchIndex(): Promise<SearchIndex> {
  const { data } = await getSearchIndex(await sessionRequest());
  return data;
}
