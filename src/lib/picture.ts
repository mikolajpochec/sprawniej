/** Pictures people pick for themselves: cut to a square and made small, so they load fast for everyone. */

const SIZE = 256

/** the part of the picture to keep, in its own pixels */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/** `area` (a square) of the picture, or its centre when none is given */
export async function squarePicture(file: Blob, area?: Area): Promise<Blob> {
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('This file isn’t a picture Sprawniej can open. Try a PNG or JPEG.')
  })
  const side = area ? Math.min(area.width, area.height) : Math.min(image.width, image.height)
  const x = area ? area.x : (image.width - side) / 2
  const y = area ? area.y : (image.height - side) / 2
  const size = Math.min(SIZE, Math.round(side))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(image, x, y, side, side, 0, 0, size, size)
  image.close()
  const encode = (type: string) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.9))
  // browsers that can't make WebP give back a PNG
  const blob = (await encode('image/webp')) ?? (await encode('image/png'))
  if (!blob) throw new Error('Sprawniej couldn’t read this picture. Try another one.')
  return blob
}
