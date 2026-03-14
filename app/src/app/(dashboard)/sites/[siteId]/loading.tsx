export default function Loading() {
  return (
    <div className="p-5 space-y-5 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 bg-gray-200 rounded" />

      {/* Site header info */}
      <div className="space-y-2">
        <div className="h-7 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-3 border-b border-gray-200 pb-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-16 bg-gray-200 rounded" />
        ))}
      </div>

      {/* Content area */}
      <div className="space-y-3">
        <div className="bg-gray-200 rounded-xl h-40" />
        <div className="bg-gray-200 rounded-xl h-32" />
      </div>
    </div>
  )
}
