export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface MarkerStyle {
  color: string;
  size: number;
  showBadge: boolean;
  showLabel?: boolean;
}

export interface HotspotSource {
  kind: 'user-created' | 'imported' | 'duplicated';
  nodePath?: string;
  originalName?: string;
  detectedType?: string;
}

export interface HotspotItem {
  id: string;                      // Unique UUID
  name: string;                    // Title (e.g. "Phòng khách", "Ban công")
  type: 'navigation' | 'info';     // Categorization
  position: Vector3D;              // 3D coordinate on surface
  rotation: Vector3D;              // View orientation (Pitch, Yaw, Roll degrees)
  visible: boolean;                // Visibility toggle
  locked: boolean;                 // Locked against accidental movement
  marker: MarkerStyle;             // Color, size, badge
  source: HotspotSource;           // Provenance tracking
  notes?: string;                  // Optional notes
  createdAt: string;
  updatedAt: string;
}

export interface CandidateHotspot {
  id: string;
  name: string;
  nodePath: string;
  nodeType: 'Camera' | 'Empty' | 'Mesh' | 'Metadata';
  position: Vector3D;
  originalObject: any;
  selected: boolean;
}

export type HotspotFilterType = 'all' | 'visible' | 'hidden' | 'imported' | 'user';
export type HotspotSortType = 'index' | 'name' | 'time';
