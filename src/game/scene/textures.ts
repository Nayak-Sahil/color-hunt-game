import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

/**
 * Procedural textures drawn once on a canvas. They add grain and pattern so the
 * flat-shaded world reads as grass, asphalt, shingles and plaster without asset files.
 */
const cache = new Map<string, Texture>()

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void

function make(key: string, size: number, repeat: number, paint: Painter): Texture {
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  paint(ctx, size)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, colors: string[], maxRadius: number): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
    const r = 0.5 + Math.random() * maxRadius
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function grassTexture(): Texture {
  return make('grass', 512, 32, (ctx, size) => {
    ctx.fillStyle = '#6da95a'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 9000, ['#5e9a4e', '#7cb668', '#639f52', '#86bd6f', '#578f47'], 2.2)
    // Grass blades: short strokes in varied greens.
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      ctx.strokeStyle = Math.random() > 0.5 ? '#4f8a42' : '#8cc476'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4)
      ctx.stroke()
    }
  })
}

export function asphaltTexture(): Texture {
  return make('asphalt', 512, 20, (ctx, size) => {
    ctx.fillStyle = '#4b4f57'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 16000, ['#40444b', '#565b63', '#3c3f45', '#5d626a'], 1.4)
    // A few cracks.
    ctx.strokeStyle = '#3a3d43'
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      let x = Math.random() * size
      let y = Math.random() * size
      ctx.moveTo(x, y)
      for (let s = 0; s < 12; s++) {
        x += (Math.random() - 0.5) * 30
        y += (Math.random() - 0.5) * 30
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  })
}

export function sidewalkTexture(): Texture {
  return make('sidewalk', 512, 16, (ctx, size) => {
    ctx.fillStyle = '#cbc6bb'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 7000, ['#c2bdb2', '#d4cfc4', '#bfb9ad'], 1.6)
    ctx.strokeStyle = '#aaa59a'
    ctx.lineWidth = 3
    const tile = size / 4
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(i * tile, 0)
      ctx.lineTo(i * tile, size)
      ctx.moveTo(0, i * tile)
      ctx.lineTo(size, i * tile)
      ctx.stroke()
    }
  })
}

export function pavingTexture(): Texture {
  return make('paving', 512, 12, (ctx, size) => {
    ctx.fillStyle = '#b9b1a4'
    ctx.fillRect(0, 0, size, size)
    const tile = size / 8
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const shade = 170 + Math.floor(Math.random() * 30)
        ctx.fillStyle = `rgb(${shade + 8}, ${shade}, ${shade - 12})`
        const offset = row % 2 === 0 ? 0 : tile / 2
        ctx.fillRect(col * tile + offset + 2, row * tile + 2, tile - 4, tile - 4)
      }
    }
  })
}

export function shingleTexture(): Texture {
  return make('shingles', 256, 4, (ctx, size) => {
    ctx.fillStyle = '#9a9a9a'
    ctx.fillRect(0, 0, size, size)
    const rowHeight = size / 8
    const shingleWidth = size / 6
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 === 0 ? 0 : shingleWidth / 2
      for (let col = -1; col < 7; col++) {
        const shade = 140 + Math.floor(Math.random() * 60)
        ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`
        ctx.fillRect(col * shingleWidth + offset + 1, row * rowHeight + 1, shingleWidth - 2, rowHeight - 2)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, row * rowHeight + rowHeight - 3, size, 3)
    }
  })
}

export function plasterTexture(): Texture {
  return make('plaster', 256, 2, (ctx, size) => {
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 5000, ['#dedede', '#f2f2f2', '#d6d6d6'], 1.5)
  })
}

export function woodTexture(): Texture {
  return make('wood', 256, 2, (ctx, size) => {
    ctx.fillStyle = '#b48a62'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#a07852' : '#c29a72'
      ctx.lineWidth = 1 + Math.random() * 3
      ctx.beginPath()
      const y = Math.random() * size
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size / 3, y + (Math.random() - 0.5) * 12, (size * 2) / 3, y + (Math.random() - 0.5) * 12, size, y)
      ctx.stroke()
    }
  })
}

export function leafTexture(): Texture {
  return make('leaf', 256, 3, (ctx, size) => {
    ctx.fillStyle = '#4f8f45'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 6000, ['#3f7a38', '#5da052', '#467f3d', '#6bb05f'], 4)
  })
}
