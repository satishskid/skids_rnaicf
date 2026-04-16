// Web backend for @skids/liquid-ai.
//
// Safety-critical invariants (see specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md):
//   1. Zero cloud egress. Shards are fetched same-origin only, from MODEL_ORIGIN_PATH,
//      which the SKIDS worker proxies from the R2 `skids-models` bucket. We never
//      invoke the web-llm built-in downloader (which would hit HuggingFace).
//   2. Per-shard SHA-256 verification. Mismatch → throw, never silently fall back.
//   3. OPFS caching (not IndexedDB) for 300 MB+ weight shards.
//   4. Manifest is a literal constant — no dynamic "latest" resolution.
//
// WebLLM wiring note (2026-04-16, PR #11):
//   After the loader verifies every shard against MODEL_MANIFEST.sha256 and
//   hydrates them into OPFS, we hand off to `@mlc-ai/web-llm`'s MLCEngine for
//   the actual WebGPU inference. WebLLM will re-fetch the shards from the same
//   same-origin URL (satisfied from the browser HTTP cache) and initialize
//   the WebGPU pipeline. `useIndexedDBCache: false` keeps WebLLM's own caching
//   layer off — OPFS is our single source of truth.
//
//   Image input: WebLLM's OpenAI-compatible API accepts `image_url` content
//   parts with either http URLs or base64 data URLs. We convert Blob /
//   ImageBitmap inputs to base64 data URLs before sending; nothing ever
//   leaves the browser.

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

// Lazy type-only imports from @mlc-ai/web-llm. The module is import()'d at
// call time so test builds and SSR paths don't blow up on missing WebGPU
// globals during module evaluation.
type MLCEngine = import('@mlc-ai/web-llm').MLCEngine
type AppConfig = import('@mlc-ai/web-llm').AppConfig
type InitProgressReport = import('@mlc-ai/web-llm').InitProgressReport
type ChatCompletionContentPart =
  import('@mlc-ai/web-llm').ChatCompletionContentPart

export interface LoadOptions {
  onProgress?: (pct: number) => void
  signal?: AbortSignal
  manifest?: ModelManifest
  // Test / DI seams — both default to real browser globals.
  fetchImpl?: typeof fetch
  opfs?: OpfsHandle
  // When true, skip the MLCEngine handoff after shard verification. Used by
  // the readiness-check / pre-flight path where we only need to confirm
  // every shard is reachable + integrity-clean but aren't ready to spin up
  // WebGPU yet. Defaults to false.
  verifyOnly?: boolean
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

export class PlaceholderManifestError extends Error {
  constructor(version: string) {
    super(
      `liquid-ai: MODEL_MANIFEST is still placeholder (${version}) — refusing to ` +
        `init WebLLM because real shards are not yet uploaded to R2. Replace the ` +
        `PENDING-PIN values in packages/shared/src/ai/model-manifest.ts first.`,
    )
    this.name = 'PlaceholderManifestError'
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

// Build the WebLLM AppConfig that points MLCEngine at our same-origin R2
// proxy. `modelShardPath` already encodes `{id}/{version}`; we strip the
// trailing shard-name segment so WebLLM uses the directory form it expects
// (`${model}/ndarray-cache.json` etc.).
function buildWebLlmAppConfig(manifest: ModelManifest): AppConfig {
  const anyShardName = manifest.shards[0]?.name ?? 'ndarray-cache.json'
  const fullUrl = modelShardPath(manifest, anyShardName)
  // Relative path → absolute with origin so WebLLM's internal fetch (which
  // can be called from a worker context where `location` might differ) has
  // a stable URL to resolve against.
  const origin =
    typeof globalThis !== 'undefined' && typeof (globalThis as any).location?.origin === 'string'
      ? (globalThis as any).location.origin as string
      : ''
  const baseDir = fullUrl.slice(0, fullUrl.lastIndexOf('/'))
  const modelBase = origin ? `${origin}${baseDir}` : baseDir
  return {
    model_list: [
      {
        model: modelBase,
        model_id: manifest.id,
        // Model library wasm lives alongside the shards under the same prefix.
        model_lib: `${modelBase}/model.wasm`,
        overrides: {
          context_window_size: 4096,
        },
      },
    ],
    useIndexedDBCache: false,
  }
}

// Convert a Blob / ImageBitmap to a base64 data URL suitable for WebLLM's
// `image_url` content part.
async function imageToDataUrl(input: Blob | ImageBitmap): Promise<string> {
  if (input instanceof Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(input)
    })
  }
  // ImageBitmap → Canvas → PNG blob → data URL.
  const canvas = new OffscreenCanvas(input.width, input.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('liquid-ai: OffscreenCanvas 2d context unavailable')
  ctx.drawImage(input, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return await imageToDataUrl(blob)
}

function isPlaceholderVersion(manifest: ModelManifest): boolean {
  if (manifest.version.startsWith('PENDING-PIN')) return true
  return manifest.shards.some((s) => s.sha256 === 'PENDING-PIN')
}

export class LiquidModel {
  private readonly _manifest: ModelManifest
  private readonly _opfs: OpfsHandle
  private readonly _shards: ReadonlyArray<ShardBytes>
  private _engine: MLCEngine | null = null

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

  // Count of verified + cached shards. Useful for readiness/diagnostics.
  shardCount(): number {
    return this._shards.length
  }

  // Lazily initialise the WebLLM MLCEngine. Safe to call repeatedly — the
  // second+ calls are no-ops. The engine cannot be constructed unless the
  // manifest has been pinned to real SHAs (otherwise WebLLM would load
  // placeholder bytes and crash on first forward pass, silently wasting
  // ~300MB of WebGPU memory).
  async initEngine(onProgress?: (p: InitProgressReport) => void): Promise<MLCEngine> {
    if (this._engine) return this._engine
    if (isPlaceholderVersion(this._manifest)) {
      throw new PlaceholderManifestError(this._manifest.version)
    }

    // Dynamic import → skipped entirely when the caller is only doing
    // capability probing or running under Node (tests).
    const webllm = await import('@mlc-ai/web-llm')
    const appConfig = buildWebLlmAppConfig(this._manifest)
    this._engine = await webllm.CreateMLCEngine(this._manifest.id, {
      appConfig,
      initProgressCallback: onProgress,
    })
    return this._engine
  }

  async infer<TSchema extends z.ZodTypeAny>(
    prompt: string,
    image: Blob | ImageBitmap | null,
    schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    const engine = await this.initEngine()

    // Build OpenAI-style multimodal content.
    const content: Array<ChatCompletionContentPart> = []
    if (image) {
      const url = await imageToDataUrl(image)
      content.push({ type: 'image_url', image_url: { url } })
    }
    content.push({ type: 'text', text: prompt })

    const resp = await engine.chat.completions.create({
      messages: [{ role: 'user', content }],
      // Force JSON output. The model must emit a well-formed JSON object;
      // we then validate it with the zod schema.
      response_format: { type: 'json_object' },
      max_tokens: 512,
      temperature: 0.1,
    })

    const text = resp.choices[0]?.message?.content ?? ''
    if (!text) {
      throw new Error('liquid-ai: empty inference response')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      throw new Error(
        `liquid-ai: inference response was not valid JSON — ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    return schema.parse(parsed)
  }

  async unload(opts: { clearCache?: boolean } = {}): Promise<void> {
    if (this._engine) {
      await this._engine.unload()
      this._engine = null
    }
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

  const model = new LiquidModel(manifest, opfs, loaded)
  // Pre-init the engine unless the caller is doing a readiness check or
  // the manifest is still placeholder. initEngine() itself throws on
  // placeholder manifests so we guard here too to keep loadModel() usable
  // for capability probing before real shards are uploaded.
  if (!options.verifyOnly && !isPlaceholderVersion(manifest)) {
    await model.initEngine()
  }
  return model
}
