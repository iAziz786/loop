import {
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  CROP_LOSS_WARNING_THRESHOLD,
} from './constants'

export interface CropMetrics {
  scale: number
  offsetX: number
  offsetY: number
  cropLossPercent: number
}

export function computeCropMetrics(
  imgWidth: number,
  imgHeight: number,
  targetWidth: number = OUTPUT_WIDTH,
  targetHeight: number = OUTPUT_HEIGHT,
): CropMetrics {
  const targetAspect = targetWidth / targetHeight
  const imgAspect = imgWidth / imgHeight

  let scale: number
  let offsetX: number
  let offsetY: number

  if (imgAspect > targetAspect) {
    // Image is wider — scale to match height, crop sides
    scale = targetHeight / imgHeight
    const scaledWidth = imgWidth * scale
    offsetX = (scaledWidth - targetWidth) / 2
    offsetY = 0
  } else {
    // Image is taller — scale to match width, crop top/bottom
    scale = targetWidth / imgWidth
    const scaledHeight = imgHeight * scale
    offsetX = 0
    offsetY = (scaledHeight - targetHeight) / 2
  }

  // Crop loss: fraction of original image area that gets cropped
  const visibleWidth = targetWidth / scale
  const visibleHeight = targetHeight / scale
  const visibleArea = visibleWidth * visibleHeight
  const totalArea = imgWidth * imgHeight
  const cropLossPercent = 1 - visibleArea / totalArea

  return { scale, offsetX, offsetY, cropLossPercent }
}

export function shouldWarnCropLoss(imgWidth: number, imgHeight: number): boolean {
  const { cropLossPercent } = computeCropMetrics(imgWidth, imgHeight)
  return cropLossPercent > CROP_LOSS_WARNING_THRESHOLD
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export async function downscaleIfNeeded(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const { naturalWidth: w, naturalHeight: h } = img

    if (w <= MAX_IMAGE_WIDTH && h <= MAX_IMAGE_HEIGHT) {
      return { blob: file, width: w, height: h }
    }

    // Compute scale to fit within max dimensions
    const scale = Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h)
    const newW = Math.round(w * scale)
    const newH = Math.round(h * scale)

    const canvas = document.createElement('canvas')
    canvas.width = newW
    canvas.height = newH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, newW, newH)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
        'image/png',
      )
    })

    return { blob, width: newW, height: newH }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function createThumbnail(blob: Blob, size: number = 160): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const { naturalWidth: w, naturalHeight: h } = img

    const scale = Math.min(size / w, size / h)
    const newW = Math.round(w * scale)
    const newH = Math.round(h * scale)

    const canvas = document.createElement('canvas')
    canvas.width = newW
    canvas.height = newH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, newW, newH)

    return canvas.toDataURL('image/jpeg', 0.7)
  } finally {
    URL.revokeObjectURL(url)
  }
}
