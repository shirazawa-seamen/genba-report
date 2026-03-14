export default function Loading() {
  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
      <div className="h-7 w-32 bg-gray-200 rounded mb-6" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="space-y-4">
          <div>
            <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-11 w-full bg-gray-200 rounded-xl" />
          </div>
          <div>
            <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-11 w-full bg-gray-200 rounded-xl" />
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
