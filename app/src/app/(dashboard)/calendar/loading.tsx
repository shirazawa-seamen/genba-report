export default function Loading() {
  return (
    <div className="p-5 space-y-5 animate-pulse">
      {/* Month navigation header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 bg-gray-200 rounded" />
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded mx-auto w-6" />
        ))}
      </div>

      {/* Calendar grid (5 weeks) */}
      <div className="grid grid-cols-7 gap-1">
        {[...Array(35)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-14" />
        ))}
      </div>
    </div>
  )
}
