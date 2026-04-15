// Pinned model manifest for on-device Liquid AI.
// Single source of truth consumed by both:
//   - packages/liquid-ai (web client: fetches + SHA-verifies each shard)
//   - apps/worker/src/routes/models.ts (same-origin R2 proxy: validates URL params)
//
// Version is a literal constant — no dynamic "latest" resolution at runtime.
// Silent upgrades are a safety regression for clinical use. When the Liquid AI
// model is re-released, update the version, shard list, and per-shard sha256
// values together in a single reviewable diff.

export const MODEL_ORIGIN_PATH = '/api/models'

export interface ShardDescriptor {
  readonly name: string
  readonly sha256: string
  readonly sizeBytes: number
}

export interface ModelManifest {
  readonly id: string
  readonly quantization: string
  readonly version: string
  readonly totalSizeBytes: number
  readonly shards: readonly ShardDescriptor[]
}

// TODO(phase-02a-web): replace placeholder version + sha256 values with the
// real Liquid AI release hashes before R2 upload. Tracking in RUNBOOK under
// "Phase 02a-web model provisioning". The placeholder values are clearly
// marked so a pre-flight check can reject them in non-dev builds.
export const MODEL_MANIFEST: ModelManifest = {
  id: 'liquid-ai/LFM2.5-VL-450M',
  quantization: 'q4f16_1',
  version: 'PENDING-PIN-2026-04-15',
  totalSizeBytes: 314_572_800,
  shards: [
    {
      name: 'mlc-chat-config.json',
      sha256: 'PENDING-PIN',
      sizeBytes: 4096,
    },
    {
      name: 'ndarray-cache.json',
      sha256: 'PENDING-PIN',
      sizeBytes: 131_072,
    },
    {
      name: 'tokenizer.json',
      sha256: 'PENDING-PIN',
      sizeBytes: 2_097_152,
    },
    {
      name: 'params_shard_0.bin',
      sha256: 'PENDING-PIN',
      sizeBytes: 33_554_432,
    },
    // Additional params_shard_N.bin entries land when the real manifest is pinned.
  ],
} as const

export function modelShardPath(manifest: ModelManifest, shardName: string): string {
  return `${MODEL_ORIGIN_PATH}/${encodeURIComponent(manifest.id)}/${encodeURIComponent(manifest.version)}/${encodeURIComponent(shardName)}`
}

export function isPlaceholderManifest(manifest: ModelManifest): boolean {
  if (manifest.version.startsWith('PENDING-PIN')) return true
  return manifest.shards.some((s) => s.sha256 === 'PENDING-PIN')
}

export function findShard(
  manifest: ModelManifest,
  shardName: string,
): ShardDescriptor | undefined {
  return manifest.shards.find((s) => s.name === shardName)
}

// R2 key layout: models/{modelId}/{version}/{shard}
export function modelR2Key(manifest: ModelManifest, shardName: string): string {
  return `models/${manifest.id}/${manifest.version}/${shardName}`
}
