export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 bg-gray-200 rounded mb-6" />

      {/* Header */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-28 bg-gray-200 rounded" />
      </div>

      {/* Progress section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
        <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded-full" />
              <div className="h-4 w-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Summary text */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
        <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <div className="h-11 flex-1 bg-gray-200 rounded-xl" />
        <div className="h-11 flex-1 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
