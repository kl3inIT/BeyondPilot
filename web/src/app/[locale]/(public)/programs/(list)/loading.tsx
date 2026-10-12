import { ProgramsSkeleton } from "@/features/program/programs-skeleton";

// Only the list is in this group: a program's own page answers not-found, which a skeleton above
// it would turn into a streamed 200.
export default function ProgramsLoading() {
  return <ProgramsSkeleton />;
}
