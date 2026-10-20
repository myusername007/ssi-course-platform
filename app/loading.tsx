import { Bar, CardSkeleton } from "../components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Bar className="h-9 w-40" />
        <Bar className="h-10 w-44" />
      </div>
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
