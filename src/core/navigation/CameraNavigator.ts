import * as THREE from 'three';
import { CameraPathfindingService } from '../../modules/camera-path/services/CameraPathfindingService.ts';
import type { RouteSearchResult } from '../../modules/camera-path/services/CameraPathfindingService.ts';
import { SmoothRotationService } from '../../modules/camera-path/services/SmoothRotationService.ts';
import type { HotspotItem } from '../../modules/hotspots/types/hotspot.types.ts';
import type { CameraWaypoint, CameraPath } from '../../modules/camera-path/types/cameraPath.types.ts';
import type { WaypointEdge } from '../../modules/camera-path/types/waypointGraph.types.ts';
import { WaypointGraphStore } from '../../modules/camera-path/store/WaypointGraphStore.ts';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type NavigationState = 'idle' | 'flying';

export interface NavigationCallbacks {
  onFlightStart?: (info: { targetName: string; durationSeconds: number; mode: string }) => void;
  onFlightProgress?: (progress: number, currentTime: number, duration: number) => void;
  onFlightComplete?: (info: { targetName: string }) => void;
  onFlightCancelled?: () => void;
  onNotification?: (msg: string, type: 'info' | 'warning' | 'success' | 'error' | 'danger') => void;
}

export class CameraNavigator {
  private camera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;
  private sceneRoot: THREE.Object3D;
  private pathfindingService: CameraPathfindingService = new CameraPathfindingService();
  private smoothRotation: SmoothRotationService = SmoothRotationService.getInstance();
  private callbacks: NavigationCallbacks = {};

  private state: NavigationState = 'idle';
  private currentProgress: number = 0; // 0 to 1
  private currentDuration: number = 4.0;
  private currentElapsed: number = 0;
  private uTurnStart: number = 0.6;

  // Active Flight Data
  private activeCurve: THREE.Curve<THREE.Vector3> | null = null;
  private startPosition: THREE.Vector3 = new THREE.Vector3();
  private endPosition: THREE.Vector3 = new THREE.Vector3();
  private startQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private endQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private currentTargetName: string = '';

  constructor(
    camera: THREE.PerspectiveCamera,
    orbitControls: OrbitControls,
    sceneRoot: THREE.Object3D,
    callbacks: NavigationCallbacks = {}
  ) {
    this.camera = camera;
    this.orbitControls = orbitControls;
    this.sceneRoot = sceneRoot;
    this.callbacks = callbacks;
  }

  public getState(): NavigationState {
    return this.state;
  }

  public isNavigating(): boolean {
    return this.state === 'flying';
  }

  public getTargetName(): string {
    return this.currentTargetName;
  }

  /**
   * Navigates to a hotspot from wherever the camera is currently positioned
   */
  public navigateToHotspot(
    destHotspot: HotspotItem,
    hotspots: HotspotItem[],
    waypoints: CameraWaypoint[],
    paths: CameraPath[],
    edges?: WaypointEdge[]
  ): boolean {
    // Interruption check: If already flying, stop previous motion cleanly
    if (this.state === 'flying') {
      this.stop(false);
    }

    const currentPos = this.camera.position.clone();
    const currentQuat = this.camera.quaternion.clone();

    // Use passed edges or query WaypointGraphStore
    const activeEdges = edges || WaypointGraphStore.getInstance().getAllEdges();

    // Run dynamic pathfinding & collision validation
    const result: RouteSearchResult = this.pathfindingService.findOptimalRoute(
      currentPos,
      currentQuat,
      destHotspot,
      hotspots,
      waypoints,
      paths,
      this.sceneRoot,
      activeEdges
    );

    if (!result.success || !result.targetPosition || !result.targetQuaternion) {
      this.callbacks.onNotification?.(
        result.message || 'Không tìm thấy đường bay an toàn tới điểm này.',
        'warning'
      );
      return false;
    }

    // Calculate angular distance to destination orientation
    let arrivalTangentQuat = currentQuat.clone();
    if (result.curve) {
      const endTangent = result.curve.getTangentAt(1.0).normalize();
      if (endTangent.lengthSq() > 0.001) {
        arrivalTangentQuat = this.smoothRotation.directionToQuaternion(endTangent);
      }
    } else {
      const dir = result.targetPosition.clone().sub(currentPos).normalize();
      if (dir.lengthSq() > 0.001) {
        arrivalTangentQuat = this.smoothRotation.directionToQuaternion(dir);
      }
    }

    const angleDiffRad = this.smoothRotation.computeAngularDistance(arrivalTangentQuat, result.targetQuaternion);
    const rotWindow = this.smoothRotation.computeRotationWindow({
      totalDuration: result.durationSeconds || 4.0,
      angleDiffRad,
      preferredDuration: 2.2,
      minRatio: 0.25,
      maxRatio: 0.65,
      rotationSpeedLimitDegPerSec: 180,
    });

    // Initialize Flight
    this.currentTargetName = destHotspot.name;
    this.startPosition.copy(currentPos);
    this.endPosition.copy(result.targetPosition);
    this.startQuaternion.copy(currentQuat);
    this.endQuaternion.copy(result.targetQuaternion);
    this.activeCurve = result.curve || null;
    this.currentDuration = rotWindow.speedSafeTotalDuration;
    this.uTurnStart = rotWindow.uTurnStart;
    this.currentElapsed = 0;
    this.currentProgress = 0;

    this.state = 'flying';
    this.orbitControls.enabled = false;

    this.callbacks.onFlightStart?.({
      targetName: this.currentTargetName,
      durationSeconds: this.currentDuration,
      mode: result.mode || 'graph',
    });

    return true;
  }

  /**
   * Navigates to a waypoint from current camera position
   */
  public navigateToWaypoint(
    wp: CameraWaypoint,
    sceneRoot?: THREE.Object3D
  ): boolean {
    if (this.state === 'flying') {
      this.stop(false);
    }

    const currentPos = this.camera.position.clone();
    const currentQuat = this.camera.quaternion.clone();
    const destPos = new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z);

    // Check line of sight
    const root = sceneRoot || this.sceneRoot;
    const isSafe = this.pathfindingService.isLineSafe(currentPos, destPos, root, 0.25);
    if (!isSafe && currentPos.distanceTo(destPos) > 4.0) {
      this.callbacks.onNotification?.(
        `Đường bay đến Waypoint "${wp.name}" bị tường hoặc vật cản che chắn.`,
        'warning'
      );
      return false;
    }

    // Determine target orientation
    let qDest = currentQuat.clone();
    const mode = wp.orientation?.mode || 'followPath';

    if (mode === 'manual' && wp.orientation?.yaw !== undefined) {
      qDest = this.pathfindingService.eulerToQuaternion(
        wp.orientation.yaw || 0,
        wp.orientation.pitch || 0,
        wp.orientation.roll || 0
      );
    } else if (mode === 'lookAt' && wp.orientation?.lookAtTarget) {
      const targetVec = new THREE.Vector3(
        wp.orientation.lookAtTarget.x,
        wp.orientation.lookAtTarget.y,
        wp.orientation.lookAtTarget.z
      );
      const lookDir = targetVec.sub(destPos).normalize();
      const pitch = Math.asin(Math.max(-1, Math.min(1, lookDir.y)));
      const yaw = Math.atan2(-lookDir.x, -lookDir.z);
      qDest.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    } else {
      // Follow path / view towards target
      const fwd = destPos.clone().sub(currentPos).normalize();
      if (fwd.lengthSq() > 0.001) {
        const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
        const yaw = Math.atan2(-fwd.x, -fwd.z);
        qDest.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      }
    }

    const dist = currentPos.distanceTo(destPos);
    const angleDiffRad = this.smoothRotation.computeAngularDistance(currentQuat, qDest);
    const rotWindow = this.smoothRotation.computeRotationWindow({
      totalDuration: Math.max(1.5, Math.min(6.0, dist / 3.0)),
      angleDiffRad,
      preferredDuration: 1.8,
      minRatio: 0.25,
      maxRatio: 0.65,
      rotationSpeedLimitDegPerSec: 180,
    });

    this.currentTargetName = wp.name;
    this.startPosition.copy(currentPos);
    this.endPosition.copy(destPos);
    this.startQuaternion.copy(currentQuat);
    this.endQuaternion.copy(qDest);
    this.activeCurve = null; // Direct smooth segment
    this.currentDuration = rotWindow.speedSafeTotalDuration;
    this.uTurnStart = rotWindow.uTurnStart;
    this.currentElapsed = 0;
    this.currentProgress = 0;

    this.state = 'flying';
    this.orbitControls.enabled = false;

    this.callbacks.onFlightStart?.({
      targetName: this.currentTargetName,
      durationSeconds: this.currentDuration,
      mode: 'waypoint',
    });

    return true;
  }

  /**
   * Stops ongoing flight cleanly and stabilizes camera
   */
  public stop(notify: boolean = true): void {
    if (this.state !== 'flying') return;

    this.state = 'idle';
    this.activeCurve = null;

    // Settle orbitControls target forward along current view direction
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.orbitControls.target.copy(this.camera.position).addScaledVector(forward, 5.0);
    this.orbitControls.enabled = true;

    if (notify) {
      this.callbacks.onFlightCancelled?.();
    }
  }

  /**
   * Delta-time update loop
   */
  public update(delta: number): void {
    if (this.state !== 'flying') return;

    this.currentElapsed += delta;
    this.currentProgress = Math.min(1.0, this.currentElapsed / this.currentDuration);

    // Easing: easeInOutCubic
    const t = this.currentProgress;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // 1. POSITION EVALUATION
    if (this.activeCurve) {
      const pos = this.activeCurve.getPointAt(ease);
      this.camera.position.copy(pos);
    } else {
      this.camera.position.lerpVectors(this.startPosition, this.endPosition, ease);
    }

    // 2. ORIENTATION EVALUATION
    let qTrajectory: THREE.Quaternion;
    if (this.activeCurve) {
      let tangent = this.activeCurve.getTangentAt(ease).normalize();
      if (tangent.lengthSq() < 0.0001) {
        tangent = new THREE.Vector3(0, 0, 1);
      }
      qTrajectory = this.smoothRotation.directionToQuaternion(tangent);
    } else {
      const dir = this.endPosition.clone().sub(this.startPosition).normalize();
      qTrajectory = this.smoothRotation.directionToQuaternion(dir);
    }

    const evaluatedQuat = this.smoothRotation.evaluateDecoupledOrientation({
      u: this.currentProgress,
      uTurnStart: this.uTurnStart,
      qStart: this.startQuaternion,
      qTrajectory,
      qDestination: this.endQuaternion,
      easing: 'easeInOut',
      startBlendProgress: 0.15,
    });

    this.camera.quaternion.copy(evaluatedQuat);

    // Settle controls target forward
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.orbitControls.target.copy(this.camera.position).addScaledVector(forward, 5.0);

    this.callbacks.onFlightProgress?.(
      this.currentProgress,
      this.currentElapsed,
      this.currentDuration
    );

    // 3. ARRIVAL AT DESTINATION
    if (this.currentProgress >= 1.0) {
      this.camera.position.copy(this.endPosition);
      this.camera.quaternion.copy(this.endQuaternion);

      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.endQuaternion);
      this.orbitControls.target.copy(this.endPosition).addScaledVector(fwd, 5.0);

      // Cleanly synchronize controls and reset any residual delta/pan
      (this.orbitControls as any)._sphericalDelta?.set?.(0, 0, 0);
      (this.orbitControls as any)._panOffset?.set?.(0, 0, 0);
      this.orbitControls.update();

      this.state = 'idle';
      this.activeCurve = null;
      this.orbitControls.enabled = true;

      this.callbacks.onFlightComplete?.({ targetName: this.currentTargetName });
    }
  }
}
