// SHA-256 verification via Web Crypto (browser) or Node's webcrypto (tests).
// No external dependencies, no network calls.

const HEX = '0123456789abcdef'

function bytesToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    const b = view[i]!
    out += HEX[b >>> 4]! + HEX[b & 0x0f]!
  }
  return out
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return bytesToHex(digest)
}
