import type { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types.ts';
import type { CameraPath, CameraWaypoint } from '../../camera-path/types/cameraPath.types.ts';
import type { WaypointEdge } from '../../camera-path/types/waypointGraph.types.ts';
import type { RenderMediaItem } from '../../media-gallery/types/mediaGallery.types.ts';

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

export interface GlobalWaypointGraphData {
  waypoints: CameraWaypoint[];
  edges: WaypointEdge[];
}

export interface ProjectConfigSchema {
  schemaVersion: '1.0.0' | '1.1.0' | '1.2.0' | '1.3.0';
  projectId: string;
  projectName: string;
  updatedAt: string;
  modelInfo: ModelInfoMeta;
  hotspots: HotspotItem[];
  waypoints?: CameraWaypoint[];
  waypointEdges?: WaypointEdge[];
  waypointGraph?: GlobalWaypointGraphData;
  cameraPaths?: CameraPath[];
  settings: ViewerSettings;
  exportedAt?: string;
  mediaGallery?: RenderMediaItem[];
}

