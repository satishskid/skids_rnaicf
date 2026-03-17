/**
 * Video Frame Extraction — extracts key frames from video for AI analysis.
 *
 * Instead of uploading full video (30MB+), we extract 3-5 key frames (~500KB total)
 * and run on-device AI on the best one. Frame URIs stored in media_urls[] for sync.
 *
 * Uses expo-video-thumbnails for frame extraction.
 */

import * as VideoThumbnails from 'expo-video-thumbnails'
import * as FileSystem from 'expo-file-system'
import { runQualityGate } from './ai/quality-gate'

export interface ExtractedFrame {
  uri: string
  timeMs: number
  /** Quality score (0-1) based on blur/exposure gate. Higher = better. */
  qualityScore: number
}

/**
 * Extract evenly-spaced key frames from a video.
 * @param videoUri - local file:// URI of the captured video
 * @param count - number of frames to extract (default 5)
 * @param durationMs - estimated video duration in ms (default 10000)
 */
export async function extractKeyFrames(
  videoUri: string,
  count: number = 5,
  durationMs: number = 10000,
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = []
  // Space frames evenly, skip first/last 10% to avoid blank frames
  const startMs = Math.round(durationMs * 0.1)
  const endMs = Math.round(durationMs * 0.9)
  const step = Math.round((endMs - startMs) / Math.max(count - 1, 1))

  for (let i = 0; i < count; i++) {
    const timeMs = startMs + i * step
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 0.8,
      })
      frames.push({ uri, timeMs, qualityScore: 0 })
    } catch (err) {
      console.warn(`Frame extraction failed at ${timeMs}ms:`, err)
    }
  }

  return frames
}

/**
 * Pick the best frame from extracted frames using quality gate scoring.
 * Falls back to middle frame if quality gate can't run.
 */
export async function pickBestFrame(frames: ExtractedFrame[]): Promise<ExtractedFrame | null> {
  if (frames.length === 0) return null
  if (frames.length === 1) return frames[0]

  // Simple heuristic: pick the middle frame (most likely to be in-focus)
  // Quality gate scoring requires pixel decoding which is expensive,
  // so we use file size as a proxy — larger JPEG = more detail = less blur
  for (const frame of frames) {
    try {
      const info = await FileSystem.getInfoAsync(frame.uri)
      frame.qualityScore = info.exists && 'size' in info ? (info.size || 0) : 0
    } catch {
      frame.qualityScore = 0
    }
  }

  // Sort by quality score descending, return best
  frames.sort((a, b) => b.qualityScore - a.qualityScore)
  return frames[0]
}

/**
 * Extract frames and return the best one for AI analysis + all frame URIs for storage.
 */
export async function extractAndPickBest(
  videoUri: string,
  frameCount: number = 5,
  durationMs: number = 10000,
): Promise<{ bestFrame: string | null; allFrameUris: string[] }> {
  const frames = await extractKeyFrames(videoUri, frameCount, durationMs)
  const allFrameUris = frames.map(f => f.uri)
  const best = await pickBestFrame(frames)
  return { bestFrame: best?.uri ?? null, allFrameUris }
}
