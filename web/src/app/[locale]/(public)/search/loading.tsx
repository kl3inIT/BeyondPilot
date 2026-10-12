import { SearchSkeleton } from "@/features/search/search-skeleton";

// The search neither redirects nor answers not-found, so streaming its skeleton costs no status code.
export default function SearchLoading() {
  return <SearchSkeleton />;
}
