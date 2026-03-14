export default function Loading() {
  return (
    <div className="p-5 space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-7 w-28 bg-gray-200 rounded" />

      {/* Admin menu cards */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-28" />
        ))}
      </div>

      {/* Summary section */}
      <div className="space-y-3">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="bg-gray-200 rounded-xl h-32" />
      </div>
    </div>
  )
}
