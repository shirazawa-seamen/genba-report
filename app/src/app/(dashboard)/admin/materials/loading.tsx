export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
      <div className="h-7 w-36 bg-gray-200 rounded mb-6" />
      <div className="flex gap-2 mb-6">
        <div className="h-10 flex-1 bg-gray-200 rounded-xl" />
        <div className="h-10 w-28 bg-gray-200 rounded-xl" />
      </div>
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 w-28 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-40 bg-gray-200 rounded" />
            </div>
            <div className="h-5 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
