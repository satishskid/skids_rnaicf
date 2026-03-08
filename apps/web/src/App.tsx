import { MODULE_CONFIGS } from '@skids/shared'

export function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="font-black">SKIDS</span>
              <span className="font-light text-white/70 ml-1">screen</span>
              <span className="ml-2 text-sm font-normal bg-white/20 px-2 py-0.5 rounded-full">v3.0</span>
            </h1>
            <p className="text-sm text-white/80">Doctor Dashboard</p>
          </div>
          <div className="text-sm text-white/60">
            Hono + Turso + Better Auth
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to SKIDS Screen V3</h2>
          <p className="text-gray-600">
            Doctor dashboard for reviewing screenings, managing campaigns, and population health analytics.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ✓ Shared types loaded
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {MODULE_CONFIGS.length} screening modules
            </span>
          </div>
        </div>

        {/* Module Grid */}
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Screening Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {MODULE_CONFIGS.map(mod => (
            <div
              key={mod.type}
              className="bg-white rounded-lg border p-3 hover:shadow-md transition-shadow"
            >
              <div className={`w-8 h-8 rounded-lg ${mod.color} flex items-center justify-center text-white text-xs font-bold mb-2`}>
                {mod.name.charAt(0)}
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{mod.name}</p>
              <p className="text-xs text-gray-500 truncate">{mod.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
