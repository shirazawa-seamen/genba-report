export default function Loading() {
  return (
    <div className="p-5 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-44 bg-gray-200 rounded" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-24" />
        ))}
      </div>

      {/* Content area */}
      <div className="space-y-3">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="bg-gray-200 rounded-xl h-20" />
        <div className="bg-gray-200 rounded-xl h-20" />
      </div>
    </div>
  )
}
