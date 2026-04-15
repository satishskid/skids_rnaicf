// Stub-mode tests for the web loader. No @mlc-ai/web-llm runtime; no network.
// These cover the safety-critical invariants: manifest pinning, same-origin-only
// fetch URL shape, per-shard SHA-256 verification, OPFS code path.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

import {
  MODEL_MANIFEST,
  isPlaceholderManifest,
  modelShardPath,
  type ModelManifest,
} from '../manifest'
import {
  loadModel,
  LiquidModel,
  NotImplementedError,
  ShaMismatchError,
} from './loader'
import type { OpfsHandle } from './opfs-cache'

// Ensure SubtleCrypto is present in the test runtime.
if (!(globalThis as any).crypto?.subtle) {
  ;(globalThis as any).crypto = webcrypto
}

async function sha256HexOf(bytes: Uint8Array): Promise<string> {
  const buf = await webcrypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Minimal in-memory OPFS stand-in implementing the subset we use.
class FakeWritable {
  constructor(private readonly file: FakeFile) {}
  async write(data: ArrayBuffer) {
    this.file.bytes = new Uint8Array(data).slice()
  }
  async close() {}
}
class FakeFile {
  bytes: Uint8Array = new Uint8Array()
  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength)
  }
}
class FakeFileHandle {
  constructor(public readonly file: FakeFile) {}
  async getFile() {
    return this.file
  }
  async createWritable() {
    return new FakeWritable(this.file)
  }
}
class FakeDir {
  dirs = new Map<string, FakeDir>()
  files = new Map<string, FakeFileHandle>()
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDir> {
    let d = this.dirs.get(name)
    if (!d) {
      if (!opts?.create) throw new Error('NotFoundError: ' + name)
      d = new FakeDir()
      this.dirs.set(name, d)
    }
    return d
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFileHandle> {
    let f = this.files.get(name)
    if (!f) {
      if (!opts?.create) throw new Error('NotFoundError: ' + name)
      f = new FakeFileHandle(new FakeFile())
      this.files.set(name, f)
    }
    return f
  }
  async removeEntry(name: string, _opts?: { recursive?: boolean }) {
    this.dirs.delete(name)
    this.files.delete(name)
  }
}

function fakeOpfs(): OpfsHandle {
  return { root: new FakeDir() as unknown as FileSystemDirectoryHandle }
}

async function makeManifestFor(shardBodies: Record<string, Uint8Array>): Promise<ModelManifest> {
  const shards = []
  let total = 0
  for (const [name, bytes] of Object.entries(shardBodies)) {
    const sha256 = await sha256HexOf(bytes)
    shards.push({ name, sha256, sizeBytes: bytes.byteLength })
    total += bytes.byteLength
  }
  return {
    id: 'liquid-ai/TEST-MODEL',
    quantization: 'q4f16_1',
    version: 'test-v1',
    totalSizeBytes: total,
    shards,
  }
}

function fetchFor(
  map: Record<string, Uint8Array>,
  observedUrls: string[],
): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : url.toString()
    observedUrls.push(u)
    const shardName = decodeURIComponent(u.split('/').pop()!)
    const bytes = map[shardName]
    if (!bytes) return new Response(null, { status: 404 })
    return new Response(bytes as unknown as BodyInit, { status: 200 })
  }) as unknown as typeof fetch
}

test('manifest: shipped MODEL_MANIFEST is a literal (frozen) const', () => {
  // readonly fields can't be reassigned under `as const`; spot-check runtime shape.
  assert.equal(MODEL_MANIFEST.id, 'liquid-ai/LFM2.5-VL-450M')
  assert.equal(MODEL_MANIFEST.quantization, 'q4f16_1')
  assert.ok(Array.isArray(MODEL_MANIFEST.shards))
  assert.ok(MODEL_MANIFEST.shards.length > 0)
})

test('manifest: shipped placeholder is detected (prevents accidental prod use)', () => {
  assert.equal(isPlaceholderManifest(MODEL_MANIFEST), true)
})

test('manifest: modelShardPath is same-origin relative, /api/models-prefixed', () => {
  const url = modelShardPath(MODEL_MANIFEST, 'params_shard_0.bin')
  assert.ok(url.startsWith('/api/models/'), `expected same-origin path, got ${url}`)
  assert.equal(/^https?:\/\//.test(url), false)
})

test('loadModel: downloads + caches shards, verifies SHA-256, uses only same-origin URLs', async () => {
  const bodies = {
    'a.json': new TextEncoder().encode('{"a":1}'),
    'b.bin': new Uint8Array([1, 2, 3, 4]),
  }
  const manifest = await makeManifestFor(bodies)
  const observed: string[] = []
  const opfs = fakeOpfs()
  const progress: number[] = []

  const model = await loadModel({
    manifest,
    fetchImpl: fetchFor(bodies, observed),
    opfs,
    onProgress: (p) => progress.push(p),
  })

  assert.ok(model instanceof LiquidModel)
  for (const u of observed) {
    assert.ok(u.startsWith('/api/models/'), `non-same-origin URL: ${u}`)
  }
  assert.deepEqual(progress, [0.5, 1])
})

test('loadModel: SHA-256 mismatch → ShaMismatchError (no silent fallback)', async () => {
  const bodies = { 'x.bin': new Uint8Array([9, 9, 9]) }
  const manifest = await makeManifestFor(bodies)
  // Tamper with the served bytes after manifest was computed.
  const tampered = { 'x.bin': new Uint8Array([1, 1, 1]) }
  const opfs = fakeOpfs()
  await assert.rejects(
    () => loadModel({ manifest, fetchImpl: fetchFor(tampered, []), opfs }),
    (err: unknown) => err instanceof ShaMismatchError,
  )
})

test('loadModel: reuses OPFS-cached shard without a second fetch', async () => {
  const bodies = { 'a.bin': new Uint8Array([7, 7, 7, 7]) }
  const manifest = await makeManifestFor(bodies)
  const observed: string[] = []
  const opfs = fakeOpfs()

  await loadModel({ manifest, fetchImpl: fetchFor(bodies, observed), opfs })
  const firstCallCount = observed.length

  await loadModel({ manifest, fetchImpl: fetchFor(bodies, observed), opfs })
  assert.equal(observed.length, firstCallCount, 'second load should hit OPFS cache, not refetch')
})

test('LiquidModel.infer: throws NotImplementedError (no accidental cloud egress path)', async () => {
  const bodies = { 'a.bin': new Uint8Array([1]) }
  const manifest = await makeManifestFor(bodies)
  const model = await loadModel({
    manifest,
    fetchImpl: fetchFor(bodies, []),
    opfs: fakeOpfs(),
  })
  await assert.rejects(
    () => model.infer('hello', null, {} as never),
    (err: unknown) => err instanceof NotImplementedError,
  )
})

test('LiquidModel.capabilities: reports pinned model + function-calling support', async () => {
  const bodies = { 'a.bin': new Uint8Array([1]) }
  const manifest = await makeManifestFor(bodies)
  const model = await loadModel({
    manifest,
    fetchImpl: fetchFor(bodies, []),
    opfs: fakeOpfs(),
  })
  const caps = model.capabilities()
  assert.equal(caps.modelId, manifest.id)
  assert.equal(caps.modelVersion, manifest.version)
  assert.equal(caps.quantization, manifest.quantization)
  assert.equal(caps.supportsFunctionCalling, true)
  assert.equal(caps.supportsImageInput, true)
})
