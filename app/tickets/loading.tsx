import { Bar, CardSkeleton } from "../../components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Bar className="h-9 w-44" />
        <Bar className="h-10 w-44" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </main>
  );
}
