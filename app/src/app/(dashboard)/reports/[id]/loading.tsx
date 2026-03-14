export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 bg-gray-200 rounded mb-6" />

      {/* Header */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
          <div className="h-5 w-24 bg-gray-200 rounded-full" />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
        <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Photos */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="h-4 w-16 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
