// Public API — @skids/liquid-ai/web
//
// Import path: `@skids/liquid-ai/web` (Phase 02a-web active).
// Mobile backend lives elsewhere and is deferred.

export { loadModel, LiquidModel, ShaMismatchError, NotImplementedError } from './loader'
export type { LoadOptions } from './loader'
export { MODEL_MANIFEST, modelShardPath, isPlaceholderManifest } from '../manifest'
export type { ModelManifest, ShardDescriptor } from '../manifest'
