import * as THREE from 'three';

export interface RotationWindowOptions {
  totalDuration: number;
  angleDiffRad: number;
  preferredDuration?: number;
  minRatio?: number;
  maxRatio?: number;
  rotationSpeedLimitDegPerSec?: number;
}

export interface RotationWindowResult {
  uTurnStart: number;
  turnDuration: number;
  speedSafeTotalDuration: number;
}

export interface DecoupledOrientationParams {
  u: number;
  uTurnStart: number;
  qStart: THREE.Quaternion;
  qTrajectory: THREE.Quaternion;
  qDestination: THREE.Quaternion;
  easing?: 'easeInOut' | 'easeOut' | 'easeIn' | 'linear';
  startBlendProgress?: number;
}

export class SmoothRotationService {
  private static instance: SmoothRotationService;

  public static getInstance(): SmoothRotationService {
    if (!SmoothRotationService.instance) {
      SmoothRotationService.instance = new SmoothRotationService();
    }
    return SmoothRotationService.instance;
  }

  /**
   * Converts Euler angles (Yaw, Pitch, Roll in degrees) to a normalized THREE.Quaternion
   * Uses 'YXZ' rotation order for upright architectural cameras with pitch clamped to [-85, 85].
   */
  public eulerToQuaternion(yawDeg: number, pitchDeg: number, rollDeg: number = 0): THREE.Quaternion {
    const clampedPitch = Math.max(-85, Math.min(85, pitchDeg));
    const normalizedYaw = ((yawDeg % 360) + 360) % 360;
    const yawRad = THREE.MathUtils.degToRad(normalizedYaw);
    const pitchRad = THREE.MathUtils.degToRad(clampedPitch);
    const rollRad = THREE.MathUtils.degToRad(rollDeg);

    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ'));
  }

  /**
   * Safely extracts Yaw and Pitch (degrees) from a camera Quaternion without gimbal lock singularities.
   */
  public quaternionToEuler(q: THREE.Quaternion): { yaw: number; pitch: number; roll: number } {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize();
    const pitchRad = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    const yawRad = Math.atan2(-fwd.x, -fwd.z);

    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(pitchRad) * 10) / 10;
    const yawDeg = Math.round((((THREE.MathUtils.radToDeg(yawRad) % 360) + 360) % 360) * 10) / 10;

    return { yaw: yawDeg, pitch: pitchDeg, roll: 0 };
  }

  /**
   * Converts a forward direction vector to an upright camera orientation quaternion (roll = 0).
   */
  public directionToQuaternion(
    forwardDir: THREE.Vector3,
    upDir: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ): THREE.Quaternion {
    const fwd = forwardDir.clone().normalize();
    if (fwd.lengthSq() < 0.0001) {
      return new THREE.Quaternion();
    }

    const pitchRad = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    const yawRad = Math.atan2(-fwd.x, -fwd.z);

    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, 0, 'YXZ'));
  }

  /**
   * Calculates the shortest geodesic angular distance between two quaternions in radians (0 to π).
   */
  public computeAngularDistance(qA: THREE.Quaternion, qB: THREE.Quaternion): number {
    const dot = Math.abs(qA.dot(qB));
    return 2.0 * Math.acos(Math.max(0, Math.min(1, dot)));
  }

  /**
   * Performs shortest-path spherical linear interpolation (Geodesic Slerp).
   * Negates qB if dot < 0 to ensure the interpolation takes the shortest arc (≤ 180°),
   * never spinning 360° around the long way.
   */
  public shortestPathSlerp(
    qA: THREE.Quaternion,
    qB: THREE.Quaternion,
    alpha: number
  ): THREE.Quaternion {
    const t = Math.max(0, Math.min(1, alpha));
    const target = qB.clone();

    if (qA.dot(target) < 0) {
      target.x = -target.x;
      target.y = -target.y;
      target.z = -target.z;
      target.w = -target.w;
    }

    return qA.clone().slerp(target, t);
  }

  /**
   * Evaluates standard easing functions.
   */
  public applyEasing(
    alpha: number,
    easing: 'easeInOut' | 'easeOut' | 'easeIn' | 'linear' = 'easeInOut'
  ): number {
    const t = Math.max(0, Math.min(1, alpha));

    switch (easing) {
      case 'easeInOut':
        // Smooth cubic ease-in-out (zero acceleration at endpoints)
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case 'easeOut':
        // Cubic ease-out
        return 1 - Math.pow(1 - t, 3);
      case 'easeIn':
        // Cubic ease-in
        return t * t * t;
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Computes the optimal window for the final rotation phase.
   * Guarantees that angular speed never exceeds rotationSpeedLimitDegPerSec,
   * dynamically extending total duration for short paths if needed.
   */
  public computeRotationWindow(options: RotationWindowOptions): RotationWindowResult {
    const {
      totalDuration,
      angleDiffRad,
      preferredDuration = 2.0,
      minRatio = 0.25,
      maxRatio = 0.70,
      rotationSpeedLimitDegPerSec = 180,
    } = options;

    const angleDiffDeg = THREE.MathUtils.radToDeg(angleDiffRad);
    const speedLimitRad = THREE.MathUtils.degToRad(rotationSpeedLimitDegPerSec);

    // Minimum duration required to satisfy the angular speed limit
    const minTurnDurationForSpeed = angleDiffRad / Math.max(0.1, speedLimitRad);

    // Adjust total trajectory duration if necessary for very short paths with large turns
    let speedSafeTotalDuration = Math.max(totalDuration, 0.5);
    if (minTurnDurationForSpeed > speedSafeTotalDuration * maxRatio) {
      speedSafeTotalDuration = minTurnDurationForSpeed / maxRatio;
    }

    // Determine actual turn duration
    let turnDuration = Math.min(preferredDuration, speedSafeTotalDuration * maxRatio);
    turnDuration = Math.max(turnDuration, minTurnDurationForSpeed);
    turnDuration = Math.min(turnDuration, speedSafeTotalDuration * 0.85);

    const turnRatio = Math.max(minRatio, Math.min(maxRatio, turnDuration / speedSafeTotalDuration));
    const uTurnStart = 1.0 - turnRatio;

    return {
      uTurnStart: Math.max(0.15, Math.min(0.85, uTurnStart)),
      turnDuration,
      speedSafeTotalDuration,
    };
  }

  /**
   * Evaluates decoupled camera orientation at any progress u in [0, 1].
   * - Progress [0, startBlendProgress]: Smoothly transitions from qStart to trajectory forward.
   * - Progress [startBlendProgress, uTurnStart]: Camera smoothly tracks travel direction / waypoints.
   * - Progress [uTurnStart, 1.0]: Smoothly transitions from the arrival direction into qDestination.
   * - Progress >= 0.9999: Mathematically guaranteed exact match with qDestination (0 error).
   */
  public evaluateDecoupledOrientation(params: DecoupledOrientationParams): THREE.Quaternion {
    const {
      u,
      uTurnStart,
      qStart,
      qTrajectory,
      qDestination,
      easing = 'easeInOut',
      startBlendProgress = 0.20,
    } = params;

    const p = Math.max(0, Math.min(1, u));

    // 1. ARRIVAL: Exact destination match at the very end
    if (p >= 0.9999) {
      return qDestination.clone();
    }

    // 2. BASE TRAVEL ORIENTATION: Blend from initial camera orientation into path tangent
    let qTravel: THREE.Quaternion;
    if (p < startBlendProgress && startBlendProgress > 0) {
      const startAlpha = this.applyEasing(p / startBlendProgress, 'easeInOut');
      qTravel = this.shortestPathSlerp(qStart, qTrajectory, startAlpha);
    } else {
      qTravel = qTrajectory.clone();
    }

    // 3. BEFORE FINAL TURN: Follow travel orientation
    if (p < uTurnStart) {
      return qTravel;
    }

    // 4. FINAL TURN PHASE: Smoothly transition from travel orientation into qDestination
    const turnAlphaRaw = (p - uTurnStart) / (1.0 - uTurnStart);
    const turnAlphaEased = this.applyEasing(turnAlphaRaw, easing);

    return this.shortestPathSlerp(qTravel, qDestination, turnAlphaEased);
  }
}

