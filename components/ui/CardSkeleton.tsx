import { Skeleton } from './Skeleton'

export function CardSkeleton() {
  return (
    <div className="flex h-full min-h-45 flex-col rounded-xl border border-white/10 bg-slate-900/50 p-3">
      {/* Шапка: аватар + заголовок */}
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>

      {/* Описание */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      {/* Шаги */}
      <div className="mt-3 space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-5 w-5 shrink-0 rounded" />
            <Skeleton className="h-5 flex-1 rounded" />
          </div>
        ))}
      </div>

      {/* Футер */}
      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-8" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-4" />
        </div>
      </div>
    </div>
  )
}
