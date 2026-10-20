import { Bar } from "../../../components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex justify-end">
        <Bar className="h-10 w-44" />
      </div>
      <div className="mx-auto max-w-2xl">
        <Bar className="h-4 w-24" />
        <div className="mt-6 space-y-4 rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <div className="flex gap-2">
            <Bar className="h-6 w-16" />
            <Bar className="h-6 w-16" />
          </div>
          <Bar className="h-7 w-4/5" />
          <div className="space-y-2">
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-2/3" />
          </div>
          <Bar className="h-4 w-1/2" />
          <Bar className="h-4 w-1/3" />
          <Bar className="mt-4 h-11 w-52" />
        </div>
      </div>
    </main>
  );
}
