// OPFS-backed shard cache for on-device Liquid AI weights.
//
// Why OPFS (not IndexedDB):
//   - Filesystem-grade quota (typically 60%+ of free disk)
//   - No IDB serialization tax for 300 MB+ shards
//   - Direct file-handle IO, survives reload without quota pressure
//
// Layout: <OPFS root>/liquid-ai/<modelId slug>/<version>/<shardName>

export interface OpfsHandle {
  readonly root: FileSystemDirectoryHandle
}

function slugifyModelId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export async function openOpfs(
  nav: Pick<Navigator, 'storage'> = typeof navigator !== 'undefined' ? navigator : (undefined as never),
): Promise<OpfsHandle> {
  if (!nav || !nav.storage || typeof nav.storage.getDirectory !== 'function') {
    throw new Error('liquid-ai: OPFS unavailable on this runtime')
  }
  const root = await nav.storage.getDirectory()
  return { root }
}

async function getOrCreateDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true })
}

export async function openShardDir(
  handle: OpfsHandle,
  modelId: string,
  version: string,
): Promise<FileSystemDirectoryHandle> {
  const ns = await getOrCreateDir(handle.root, 'liquid-ai')
  const model = await getOrCreateDir(ns, slugifyModelId(modelId))
  return getOrCreateDir(model, version)
}

export async function readShard(
  dir: FileSystemDirectoryHandle,
  shardName: string,
): Promise<ArrayBuffer | null> {
  try {
    const fh = await dir.getFileHandle(shardName, { create: false })
    const file = await fh.getFile()
    return await file.arrayBuffer()
  } catch {
    return null
  }
}

export async function writeShard(
  dir: FileSystemDirectoryHandle,
  shardName: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const fh = await dir.getFileHandle(shardName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(bytes)
  await writable.close()
}

export async function deleteVersionDir(
  handle: OpfsHandle,
  modelId: string,
  version: string,
): Promise<void> {
  try {
    const ns = await handle.root.getDirectoryHandle('liquid-ai', { create: false })
    const model = await ns.getDirectoryHandle(slugifyModelId(modelId), { create: false })
    await model.removeEntry(version, { recursive: true })
  } catch {
    // nothing to delete
  }
}
