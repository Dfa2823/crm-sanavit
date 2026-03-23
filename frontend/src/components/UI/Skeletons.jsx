/**
 * Premium loading skeletons for CRM Sanavit
 * Replaces generic spinners with shimmer placeholders
 */

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Header row */}
      <div className="shimmer h-10 w-full rounded-lg" />
      {/* Body rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="shimmer h-14 w-full rounded-lg"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4, cols = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${cols} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card p-6 space-y-3" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="shimmer h-4 w-20 rounded" />
          <div className="shimmer h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header skeleton */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="shimmer h-7 w-64 rounded" />
            <div className="shimmer h-4 w-40 rounded" />
          </div>
          <div className="shimmer h-10 w-36 rounded-xl" />
        </div>
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-5" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-start gap-4">
              <div className="shimmer w-11 h-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="shimmer h-3 w-20 rounded" />
                <div className="shimmer h-7 w-14 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Section skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="card p-5" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-start gap-4">
              <div className="shimmer w-11 h-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="shimmer h-3 w-16 rounded" />
                <div className="shimmer h-7 w-12 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <CardSkeleton count={4} />
      <TableSkeleton rows={5} />
    </div>
  )
}
