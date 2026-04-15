// @skids/db — Turso database client and utilities

import { createClient, type Client } from '@libsql/client'

export type { Client as TursoClient }

export interface TursoConfig {
  url: string
  authToken: string
}

let _client: Client | null = null

/** Get or create the Turso client singleton */
export function getTursoClient(config?: TursoConfig): Client {
  if (_client) return _client

  // Local-dev fallback only. In Workers there's no `process`; the worker
  // always passes `config` through from `c.env`. Access via globalThis so
  // tsc doesn't require @types/node to know the identifier.
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  const env = g.process?.env ?? {}
  const url = config?.url || env.TURSO_URL
  const authToken = config?.authToken || env.TURSO_AUTH_TOKEN

  if (!url || !authToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN are required')
  }

  _client = createClient({ url, authToken })
  return _client
}

/** Create a fresh client (useful for CF Workers where singletons don't persist) */
export function createTursoClient(config: TursoConfig): Client {
  return createClient({
    url: config.url,
    authToken: config.authToken,
  })
}
