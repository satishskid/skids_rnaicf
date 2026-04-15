// Re-export of the canonical manifest, which now lives in @skids/shared so
// the worker shard-route and this web client validate against the same
// source of truth.

export {
  MODEL_MANIFEST,
  MODEL_ORIGIN_PATH,
  modelShardPath,
  modelR2Key,
  findShard,
  isPlaceholderManifest,
} from '@skids/shared'

export type { ModelManifest, ShardDescriptor } from '@skids/shared'
