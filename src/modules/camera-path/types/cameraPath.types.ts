import { Vector3D } from '../../hotspots/types/hotspot.types';

export type WaypointOrientationMode = 'followPath' | 'manual' | 'lookAt';
export type TerminalOrientationMode = 'hotspot' | 'custom' | 'followPath';
export type CameraPathCurveType = 'spline' | 'polyline';
export type CameraPathEasing = 'easeInOut' | 'easeIn' | 'easeOut' | 'linear';

export interface PathTerminalOrientation {
  mode: TerminalOrientationMode;
  useCustomPosition?: boolean;// Whether end camera position is customized (independent from hotspot)
  position?: Vector3D;        // Custom end camera position (x, y, z)
  yaw?: number;               // Horizontal angle in degrees (0 - 360)
  pitch?: number;             // Vertical angle in degrees (-85 - 85)
  roll?: number;              // Tilt in degrees (default 0)
  transitionDuration?: number;// Duration in seconds to blend to end orientation (e.g. 2.0s)
  transitionRatio?: number;   // Or fraction of trajectory (e.g. 0.25 = last 25% of path)
  easing?: 'linear' | 'easeInOut' | 'easeOut'; // Easing when rotating to end view
}

export interface WaypointOrientation {
  mode: WaypointOrientationMode;
  yaw?: number;               // Horizontal angle in degrees
  pitch?: number;             // Vertical angle in degrees
  roll?: number;              // Tilt in degrees
  lookAtTarget?: Vector3D;    // Target coordinate if mode === 'lookAt'
}

export interface CameraWaypoint {
  id: string;                 // UUID
  name: string;               // e.g. "Điểm rẽ P1", "Hành lang P2"
  position: Vector3D;         // 3D world coordinate
  orientation: WaypointOrientation;
  locked: boolean;            // Locked against gizmo drag
  dwellTimeSeconds: number;   // Pause duration at this waypoint (default 0)
  speedMultiplier?: number;   // Segment speed weighting (default 1.0)
  createdAt: string;
  updatedAt: string;
}

export interface CameraPath {
  id: string;                 // UUID
  name: string;               // e.g. "Phòng khách -> Ban công"
  fromHotspotId: string;      // Start Hotspot ID
  toHotspotId: string;        // Destination Hotspot ID
  waypointIds: string[];      // Ordered sequence of waypoint IDs
  curveType: CameraPathCurveType;
  tension: number;            // Catmull-Rom spline tension (0.0 to 1.0, default 0.5)
  durationSeconds: number;    // Total duration in seconds (e.g. 8s)
  easing: CameraPathEasing;
  bidirectional: boolean;     // Enable reverse traversal
  enabled: boolean;
  endPosition?: Vector3D;     // Custom end position override
  useCustomEndPosition?: boolean; // Whether end position is overridden
  startOrientation?: PathTerminalOrientation; // Optional start camera orientation
  endOrientation?: PathTerminalOrientation;   // End Camera Orientation
  warnings?: string[];        // Collision or wall-clipping warnings
  createdAt: string;
  updatedAt: string;
}

export interface EvaluatedTransform {
  position: Vector3D;
  target: Vector3D;
  up: Vector3D;
  quaternion?: { x: number; y: number; z: number; w: number };
}
