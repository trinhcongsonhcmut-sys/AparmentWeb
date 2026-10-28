import { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types';
import { CameraPath, CameraWaypoint } from '../../camera-path/types/cameraPath.types';
import { RenderMediaItem } from '../../media-gallery/types/mediaGallery.types';

export interface ModelInfoMeta {
  fileName: string;
  format: 'glb' | 'gltf' | 'usdz' | 'unknown';
  fileSize: number;
  fingerprint: string;
  boundsCenter: Vector3D;
  boundsSize: Vector3D;
  vertexCount?: number;
  meshCount?: number;
}

export interface ViewerSettings {
  markerOcclusion: boolean;
  showLabels: boolean;
  showIndexes: boolean;
  gridVisible: boolean;
}

export interface ProjectConfigSchema {
  schemaVersion: '1.0.0';
  projectId: string;
  projectName: string;
  updatedAt: string;
  modelInfo: ModelInfoMeta;
  hotspots: HotspotItem[];
  waypoints?: CameraWaypoint[];
  cameraPaths?: CameraPath[];
  settings: ViewerSettings;
  exportedAt?: string;
  mediaGallery?: RenderMediaItem[];
}

