export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      <div className="h-7 w-36 bg-gray-200 rounded mb-6" />

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-200 rounded-full" />
        ))}
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-5 w-36 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
