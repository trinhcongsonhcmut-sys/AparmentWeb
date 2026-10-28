import * as THREE from 'three';
import {
  CameraPath,
  CameraWaypoint,
  EvaluatedTransform,
  CameraPathEasing,
} from '../types/cameraPath.types';
import { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class PathTrajectoryEvaluator {
  private curve: THREE.Curve<THREE.Vector3> | null = null;
  private pathLength: number = 0;
  private nodePositions: THREE.Vector3[] = [];
  private waypointsList: CameraWaypoint[] = [];
  private fromHotspot: HotspotItem | null = null;
  private toHotspot: HotspotItem | null = null;

  public buildTrajectory(
    path: CameraPath,
    waypoints: CameraWaypoint[],
    fromHotspot?: HotspotItem,
    toHotspot?: HotspotItem
  ): boolean {
    this.waypointsList = waypoints;
    this.fromHotspot = fromHotspot || null;
    this.toHotspot = toHotspot || null;

    const points: THREE.Vector3[] = [];

    // 1. Start point: fromHotspot (or first waypoint if no hotspot)
    if (fromHotspot) {
      points.push(new THREE.Vector3(fromHotspot.position.x, fromHotspot.position.y, fromHotspot.position.z));
    }

    // 2. Intermediate waypoints
    for (const wp of waypoints) {
      points.push(new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z));
    }

    // 3. End point: resolved destination position
    const endPos = this.getResolvedEndPosition(path);
    if (endPos) {
      points.push(endPos);
    }

    this.nodePositions = points;

    if (points.length < 2) {
      this.curve = null;
      this.pathLength = 0;
      return false;
    }

    if (path.curveType === 'polyline') {
      const curvePath = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 0; i < points.length - 1; i++) {
        curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]));
      }
      this.curve = curvePath;
    } else {
      // CatmullRomCurve3 with centripetal parameterization prevents wild loops
      const tension = path.tension !== undefined ? Math.max(0, Math.min(1, path.tension)) : 0.5;
      const catmull = new THREE.CatmullRomCurve3(points, false, 'centripetal', tension);
      this.curve = catmull;
    }

    this.pathLength = this.curve.getLength();
    return true;
  }

  public getResolvedEndPosition(path: CameraPath): THREE.Vector3 | null {
    if (
      (path.useCustomEndPosition || path.endOrientation?.useCustomPosition) &&
      (path.endPosition || path.endOrientation?.position)
    ) {
      const p = path.endPosition || path.endOrientation!.position!;
      return new THREE.Vector3(p.x, p.y, p.z);
    }
    if (this.toHotspot) {
      return new THREE.Vector3(this.toHotspot.position.x, this.toHotspot.position.y, this.toHotspot.position.z);
    }
    return null;
  }

  public getLength(): number {
    return this.pathLength;
  }

  public getSpacedPoints(segments: number = 100): THREE.Vector3[] {
    if (!this.curve) return [];
    return this.curve.getSpacedPoints(segments);
  }

  public evaluateAt(progressRaw: number, path: CameraPath): EvaluatedTransform | null {
    if (!this.curve || this.nodePositions.length < 2) return null;

    // Clamp progress
    const p = Math.max(0, Math.min(1, progressRaw));

    // Apply Easing
    const easedP = this.applyEasing(p, path.easing);

    // Position along curve with arc-length parameterization
    const pos = this.curve.getPointAt(easedP);

    // If at the very end, clamp exactly to resolved end position
    if (p >= 0.9999) {
      const resolved = this.getResolvedEndPosition(path);
      if (resolved) {
        pos.copy(resolved);
      }
    }

    // Tangent (direction of velocity along curve)
    let tangent = this.curve.getTangentAt(easedP);
    if (tangent.lengthSq() < 0.0001) {
      tangent = new THREE.Vector3(0, 0, 1);
    } else {
      tangent.normalize();
    }

    // Determine Orientation
    const transform = this.resolveOrientation(easedP, pos, tangent, path);

    return transform;
  }

  public eulerToQuaternion(yawDeg: number, pitchDeg: number, rollDeg: number = 0): THREE.Quaternion {
    const yawRad = THREE.MathUtils.degToRad(yawDeg);
    const pitchRad = THREE.MathUtils.degToRad(pitchDeg);
    const rollRad = THREE.MathUtils.degToRad(rollDeg);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ'));
  }

  public directionToQuaternion(dir: THREE.Vector3): THREE.Quaternion {
    const normalized = dir.clone().normalize();
    const pitch = Math.asin(Math.max(-1, Math.min(1, normalized.y)));
    const yaw = Math.atan2(-normalized.x, -normalized.z);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }

  public getEndQuaternion(path: CameraPath): THREE.Quaternion | null {
    const endMode = path.endOrientation?.mode || 'hotspot';

    if (endMode === 'custom' && path.endOrientation?.yaw !== undefined) {
      return this.eulerToQuaternion(
        path.endOrientation.yaw || 0,
        path.endOrientation.pitch || 0,
        path.endOrientation.roll || 0
      );
    }

    if (endMode === 'hotspot') {
      if (this.toHotspot?.rotation) {
        return this.eulerToQuaternion(
          this.toHotspot.rotation.y || 0,
          this.toHotspot.rotation.x || 0,
          this.toHotspot.rotation.z || 0
        );
      }
    }

    if (endMode === 'followPath') {
      if (this.curve) {
        const endTangent = this.curve.getTangentAt(1.0).normalize();
        return this.directionToQuaternion(endTangent);
      }
    }

    // Default fallback to destination hotspot rotation if present
    if (this.toHotspot?.rotation && (this.toHotspot.rotation.x || this.toHotspot.rotation.y)) {
      return this.eulerToQuaternion(
        this.toHotspot.rotation.y || 0,
        this.toHotspot.rotation.x || 0,
        this.toHotspot.rotation.z || 0
      );
    }

    return null;
  }

  private resolveOrientation(
    u: number,
    position: THREE.Vector3,
    tangent: THREE.Vector3,
    path: CameraPath
  ): EvaluatedTransform {
    // 1. Calculate Base Quaternion (from intermediate waypoints or follow path)
    const activeWaypoint = this.findDominantWaypoint(u);
    const mode = activeWaypoint?.orientation?.mode || 'followPath';

    let qBase: THREE.Quaternion;

    if (mode === 'lookAt' && activeWaypoint?.orientation?.lookAtTarget) {
      const targetVec = new THREE.Vector3(
        activeWaypoint.orientation.lookAtTarget.x,
        activeWaypoint.orientation.lookAtTarget.y,
        activeWaypoint.orientation.lookAtTarget.z
      );
      const lookDir = targetVec.clone().sub(position).normalize();
      qBase = this.directionToQuaternion(lookDir);
    } else if (mode === 'manual' && activeWaypoint?.orientation?.yaw !== undefined) {
      qBase = this.eulerToQuaternion(
        activeWaypoint.orientation.yaw || 0,
        activeWaypoint.orientation.pitch || 0,
        activeWaypoint.orientation.roll || 0
      );
    } else {
      qBase = this.directionToQuaternion(tangent);
    }

    // 2. Solve End Orientation Slerp Transition
    const qEnd = this.getEndQuaternion(path);
    if (qEnd) {
      const totalDur = Math.max(1.0, path.durationSeconds || 8.0);
      let transRatio = path.endOrientation?.transitionRatio;
      if (transRatio === undefined) {
        const transDur = path.endOrientation?.transitionDuration ?? 2.0;
        transRatio = transDur / totalDur;
      }
      const clampedRatio = Math.max(0.08, Math.min(0.6, transRatio));
      const uTurn = 1.0 - clampedRatio;

      if (u >= uTurn) {
        const alpha = Math.max(0, Math.min(1, (u - uTurn) / (1.0 - uTurn)));
        const blendEasing = path.endOrientation?.easing || 'easeInOut';
        const easedAlpha = this.applyEasing(alpha, blendEasing as any);
        qBase.slerp(qEnd, easedAlpha);
      }
    }

    // If exactly at destination (u >= 0.9999) and qEnd is set, guarantee exact qEnd
    if (u >= 0.9999 && qEnd) {
      qBase.copy(qEnd);
    }

    // Compute forward vector from quaternion
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qBase);
    const target = position.clone().addScaledVector(forward, 5.0);

    return {
      position: MathUtils.roundVector(position, 2),
      target: MathUtils.roundVector(target, 2),
      up: { x: 0, y: 1, z: 0 },
      quaternion: {
        x: qBase.x,
        y: qBase.y,
        z: qBase.z,
        w: qBase.w,
      },
    };
  }

  private findDominantWaypoint(u: number): CameraWaypoint | null {
    if (this.waypointsList.length === 0) return null;

    // Approximate waypoint parameter positions along sequence
    const totalSegments = this.waypointsList.length + 1;
    let closestIndex = Math.round(u * totalSegments) - 1;
    closestIndex = Math.max(0, Math.min(this.waypointsList.length - 1, closestIndex));

    return this.waypointsList[closestIndex] || null;
  }

  private applyEasing(t: number, easing: CameraPathEasing | 'easeIn' | 'easeOut' | 'easeInOut' | 'linear'): number {
    switch (easing) {
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return t * (2 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear':
      default:
        return t;
    }
  }
}
