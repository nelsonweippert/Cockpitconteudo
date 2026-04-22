export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-28 bg-cockpit-border rounded-xl" />
          <div className="h-3 w-40 bg-cockpit-border-light rounded" />
        </div>
        <div className="h-10 w-32 bg-cockpit-border rounded-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-9 w-28 bg-cockpit-border rounded-xl flex-shrink-0" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="cockpit-card flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-cockpit-border rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-cockpit-border-light rounded-full" />
                <div className="h-3 w-8 bg-cockpit-border-light rounded" />
                <div className="h-3 w-16 bg-cockpit-border-light rounded" />
              </div>
            </div>
            <div className="h-7 w-20 bg-cockpit-border rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
