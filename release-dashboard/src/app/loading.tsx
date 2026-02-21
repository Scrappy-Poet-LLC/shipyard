export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-5 w-px bg-gray-300" />
              <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="absolute inset-y-0 left-0 w-1.5 animate-pulse bg-gray-200" />
              <div className="py-5 pl-6 pr-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                    <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                    <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
