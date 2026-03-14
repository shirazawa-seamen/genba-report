export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 bg-gray-200 rounded mb-6" />

      {/* Header */}
      <div className="h-7 w-40 bg-gray-200 rounded mb-6" />

      {/* Form fields */}
      <div className="space-y-5">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-11 w-full bg-gray-200 rounded-xl" />
          </div>
        ))}
        <div>
          <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-24 w-full bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Submit button */}
      <div className="h-11 w-full bg-gray-200 rounded-xl mt-6" />
    </div>
  )
}
