// Placeholder shapes shown while a page's data loads.
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-surface-muted ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <div className="flex gap-2">
        <Bar className="h-6 w-16" />
        <Bar className="h-6 w-16" />
      </div>
      <div className="space-y-2">
        <Bar className="h-5 w-4/5" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-3/4" />
      </div>
      <Bar className="h-3 w-1/2" />
      <Bar className="h-5 w-1/3" />
    </div>
  );
}
