import { UseCasesSkeleton } from "@/features/usecase/use-cases-skeleton";

// Only the list is in this group: a use case's own pages answer not-found or redirect, which a
// skeleton above them would turn into a streamed 200.
export default function UseCasesLoading() {
  return <UseCasesSkeleton />;
}
