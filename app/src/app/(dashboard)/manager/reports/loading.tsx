export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded mb-6" />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-200 rounded-full" />
        ))}
      </div>

      {/* Report groups */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div>
                <div className="h-5 w-32 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-20 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
