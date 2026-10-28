export interface RenderMediaItem {
  id: string;
  hotspotId?: string;               // Linked hotspot
  title: string;
  type: 'render-2d' | 'panorama-360' | 'floorplan-2d';
  imageUrl: string;
  thumbnailUrl?: string;
  fov?: number;
  description?: string;
  capturedCameraPosition?: { x: number; y: number; z: number };
}

export interface IMediaGalleryService {
  openMedia(mediaId: string): void;
  attachMediaToHotspot(hotspotId: string, mediaItem: RenderMediaItem): void;
  getMediaForHotspot(hotspotId: string): RenderMediaItem[];
}
