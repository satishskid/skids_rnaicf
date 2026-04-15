// Web backend for @skids/liquid-ai.
//
// Safety-critical invariants (see specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md):
//   1. Zero cloud egress. Shards are fetched same-origin only, from MODEL_ORIGIN_PATH,
//      which the SKIDS worker proxies from the R2 `skids-models` bucket. We never
//      invoke the web-llm built-in downloader (which would hit HuggingFace).
//   2. Per-shard SHA-256 verification. Mismatch → throw, never silently fall back.
//   3. OPFS caching (not IndexedDB) for 300 MB+ weight shards.
//   4. Manifest is a literal constant — no dynamic "latest" resolution.

import type { z } from 'zod'
import type { CapabilityReport } from '../types'
import {
  MODEL_MANIFEST,
  type ModelManifest,
  type ShardDescriptor,
  modelShardPath,
} from '../manifest'
import {
  openOpfs,
  openShardDir,
  readShard,
  writeShard,
  deleteVersionDir,
  type OpfsHandle,
} from './opfs-cache'
import { sha256Hex } from './sha256'

export interface LoadOptions {
  onProgress?: (pct: number) => void
  signal?: AbortSignal
  manifest?: ModelManifest
  // Test / DI seams — both default to real browser globals.
  fetchImpl?: typeof fetch
  opfs?: OpfsHandle
}

export class ShaMismatchError extends Error {
  constructor(
    readonly shardName: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`liquid-ai: sha256 mismatch for ${shardName} (expected ${expected}, got ${actual})`)
    this.name = 'ShaMismatchError'
  }
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`liquid-ai: ${what} not implemented in this build`)
    this.name = 'NotImplementedError'
  }
}

type ShardBytes = { shard: ShardDescriptor; bytes: ArrayBuffer }

async function loadOneShard(
  manifest: ModelManifest,
  shard: ShardDescriptor,
  dir: FileSystemDirectoryHandle,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ShardBytes> {
  // Try cache first.
  const cached = await readShard(dir, shard.name)
  if (cached) {
    const hex = await sha256Hex(cached)
    if (hex === shard.sha256) {
      return { shard, bytes: cached }
    }
    // Cache corrupted — fall through to re-fetch.
  }

  const url = modelShardPath(manifest, shard.name)
  // Intentionally relative / same-origin: enforced by url shape (starts with /api/...).
  const res = await fetchImpl(url, { signal, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`liquid-ai: fetch failed for ${shard.name} (${res.status})`)
  const bytes = await res.arrayBuffer()

  const hex = await sha256Hex(bytes)
  if (hex !== shard.sha256) {
    throw new ShaMismatchError(shard.name, shard.sha256, hex)
  }

  await writeShard(dir, shard.name, bytes)
  return { shard, bytes }
}

export class LiquidModel {
  private readonly _manifest: ModelManifest
  private readonly _opfs: OpfsHandle
  private readonly _shards: ReadonlyArray<ShardBytes>

  constructor(manifest: ModelManifest, opfs: OpfsHandle, shards: ReadonlyArray<ShardBytes>) {
    this._manifest = manifest
    this._opfs = opfs
    this._shards = shards
  }

  capabilities(): CapabilityReport & {
    modelId: string
    modelVersion: string
    quantization: string
    supportsImageInput: boolean
    maxContextTokens: number
    supportsFunctionCalling: boolean
  } {
    return {
      tier: 'webgpu',
      hasWebGpu: true,
      deviceMemoryGb: null,
      storageFreeBytes: null,
      effectiveConnectionType: null,
      reasons: [],
      modelId: this._manifest.id,
      modelVersion: this._manifest.version,
      quantization: this._manifest.quantization,
      supportsImageInput: true,
      maxContextTokens: 4096,
      supportsFunctionCalling: true,
    }
  }

  async infer<TSchema extends z.ZodTypeAny>(
    _prompt: string,
    _image: Blob | ImageBitmap | null,
    _schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    // Real inference wiring against @mlc-ai/web-llm lands in the follow-up commit
    // (a browser harness + WebGPU device is required to verify end-to-end).
    // Keeping this as an explicit stub preserves the zero-egress invariant: no
    // code path in this commit can accidentally reach a remote model host.
    throw new NotImplementedError('infer() — real WebLLM inference')
  }

  async unload(opts: { clearCache?: boolean } = {}): Promise<void> {
    if (opts.clearCache) {
      await deleteVersionDir(this._opfs, this._manifest.id, this._manifest.version)
    }
  }
}

export async function loadModel(options: LoadOptions = {}): Promise<LiquidModel> {
  const manifest = options.manifest ?? MODEL_MANIFEST
  const fetchImpl = options.fetchImpl ?? fetch
  const opfs = options.opfs ?? (await openOpfs())
  const dir = await openShardDir(opfs, manifest.id, manifest.version)

  const loaded: ShardBytes[] = []
  let done = 0
  for (const shard of manifest.shards) {
    options.signal?.throwIfAborted?.()
    const out = await loadOneShard(manifest, shard, dir, fetchImpl, options.signal)
    loaded.push(out)
    done += 1
    options.onProgress?.(done / manifest.shards.length)
  }

  return new LiquidModel(manifest, opfs, loaded)
}
