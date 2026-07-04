import { FACES, type Face } from '../core/cube.ts'

// Camera capture + per-sticker colour sampling and classification for the
// scanner. Colour classification is center-anchored: the six centre stickers
// (whose face — and therefore colour — is known) calibrate the palette for the
// current lighting, and every other sticker is assigned to its nearest centre.
// This is robust to warm/cool lighting without hard-coded thresholds.

export type RGB = [number, number, number]

/** Fraction of the frame's shorter side used by the alignment square. */
export const GUIDE_FRACTION = 0.72

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true') // iOS: don't go fullscreen
  await video.play()
  return stream
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

/** Sample the 9 stickers from the centered guide square of the current frame,
 *  in row-major (reading) order. Each sample is a trimmed mean of a small patch
 *  to reject specular highlights. */
export function sampleFace(video: HTMLVideoElement): RGB[] {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const size = Math.min(vw, vh) * GUIDE_FRACTION
  const ox = (vw - size) / 2
  const oy = (vh - size) / 2

  const canvas = document.createElement('canvas')
  canvas.width = vw
  canvas.height = vh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0)

  const patch = Math.max(4, Math.round(size * 0.06))
  const out: RGB[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = ox + (size * (c + 0.5)) / 3
      const cy = oy + (size * (r + 0.5)) / 3
      out.push(samplePatch(ctx, cx, cy, patch))
    }
  }
  return out
}

function samplePatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number): RGB {
  const data = ctx.getImageData(Math.round(cx - rad), Math.round(cy - rad), rad * 2, rad * 2).data
  // Collect pixels, then average the middle by luminance (drop darkest/brightest
  // quartiles) to reject glare and shadow.
  const px: { r: number; g: number; b: number; l: number }[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    px.push({ r, g, b, l: 0.299 * r + 0.587 * g + 0.114 * b })
  }
  px.sort((a, b) => a.l - b.l)
  const lo = Math.floor(px.length * 0.25)
  const hi = Math.ceil(px.length * 0.75)
  let rs = 0
  let gs = 0
  let bs = 0
  let n = 0
  for (let i = lo; i < hi; i++) {
    rs += px[i].r
    gs += px[i].g
    bs += px[i].b
    n++
  }
  n = n || 1
  return [rs / n, gs / n, bs / n]
}

// --- classification ---------------------------------------------------------
function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

/** Perceptual-ish distance between two colours, in HSV, weighting hue for
 *  saturated colours and value/saturation for near-greys (white/yellow). */
function colorDist(a: RGB, b: RGB): number {
  const [ha, sa, va] = rgbToHsv(a)
  const [hb, sb, vb] = rgbToHsv(b)
  let dh = Math.abs(ha - hb)
  if (dh > 180) dh = 360 - dh
  const hueWeight = Math.min(sa, sb) // hue only matters when both are colourful
  return (
    (dh / 180) * (dh / 180) * hueWeight * 6 +
    (sa - sb) * (sa - sb) * 2 +
    (va - vb) * (va - vb) * 1.5
  )
}

/** Classify captured faces (each 9 RGB samples, indexed by the face whose
 *  centre they were scanned as) into face letters, in facelet reading order.
 *  Centres are anchors and keep their own face. */
export function classify(facesRGB: Record<Face, RGB[]>): Record<Face, Face[]> {
  const anchors = FACES.map((f) => ({ face: f, rgb: facesRGB[f][4] }))
  const out = {} as Record<Face, Face[]>
  for (const f of FACES) {
    out[f] = facesRGB[f].map((rgb, i) => {
      if (i === 4) return f
      let best = anchors[0].face
      let bd = Infinity
      for (const a of anchors) {
        const d = colorDist(rgb, a.rgb)
        if (d < bd) {
          bd = d
          best = a.face
        }
      }
      return best
    })
  }
  return out
}
