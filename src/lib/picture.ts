/** Pictures people pick for themselves: cut to a centred square and made small, so they load fast for everyone. */

const SIZE = 256

export async function squarePicture(file: Blob): Promise<Blob> {
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('This file isn’t a picture Sprawniej can open. Try a PNG or JPEG.')
  })
  const side = Math.min(image.width, image.height)
  const size = Math.min(SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size)
  image.close()
  const encode = (type: string) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.9))
  // browsers that can't make WebP give back a PNG
  const blob = (await encode('image/webp')) ?? (await encode('image/png'))
  if (!blob) throw new Error('Sprawniej couldn’t read this picture. Try another one.')
  return blob
}
