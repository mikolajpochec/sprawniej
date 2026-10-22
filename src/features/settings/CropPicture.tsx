/** Choosing which part of a new picture to show: drag it into the circle, zoom with the slider (or scroll, or pinch). */
import { useState } from 'react'
import Cropper from 'react-easy-crop'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import type { Area } from '@/lib/picture'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog'
import { Slider } from '@/ui/slider'

const MAX_ZOOM = 4

/** `image`: the picked picture's address (a data URL) */
export function CropPicture({ image, busy, onUse, onClose }: { image: string; busy: boolean; onUse: (area: Area) => void; onClose: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area>()
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Your picture</DialogTitle>
        <DialogDescription>Drag the picture to place it in the circle, and zoom to fit.</DialogDescription>
        <div className="relative h-72 overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            maxZoom={MAX_ZOOM}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <ZoomOut className="size-4 shrink-0" />
          <Slider aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={[zoom]} onValueChange={([z]) => setZoom(z)} />
          <ZoomIn className="size-4 shrink-0" />
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!area || busy} onClick={() => area && onUse(area)}>
            {busy && <Loader2 className="animate-spin" />} Use this picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
