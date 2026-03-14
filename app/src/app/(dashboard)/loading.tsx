export default function Loading() {
  return (
    <div className="p-5 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-24" />
        ))}
      </div>

      {/* Recent reports list */}
      <div className="space-y-2">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-16" />
        ))}
      </div>
    </div>
  )
}
