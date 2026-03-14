export default function Loading() {
  return (
    <div className="p-5 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-4 w-16 bg-gray-200 rounded" />
        <div className="h-7 w-36 bg-gray-200 rounded" />
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 justify-center">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-2 w-12 bg-gray-200 rounded-full" />
        ))}
      </div>

      {/* Form area */}
      <div className="space-y-4">
        <div className="bg-gray-200 rounded-xl h-12" />
        <div className="bg-gray-200 rounded-xl h-12" />
        <div className="bg-gray-200 rounded-xl h-32" />
        <div className="bg-gray-200 rounded-xl h-12" />
        <div className="bg-gray-200 rounded-xl h-40" />
      </div>
    </div>
  )
}
