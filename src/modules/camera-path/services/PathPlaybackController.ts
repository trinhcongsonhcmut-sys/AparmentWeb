import * as THREE from 'three';
import { CameraPath } from '../types/cameraPath.types';
import { PathTrajectoryEvaluator } from './PathTrajectoryEvaluator';

export type PlaybackState = 'idle' | 'playing' | 'paused';
export type PlaybackProgressCallback = (progress: number, currentTime: number, totalDuration: number) => void;

export class PathPlaybackController {
  private camera: THREE.PerspectiveCamera;
  private setControlsTarget: (target: THREE.Vector3) => void;
  private setControlsEnabled: (enabled: boolean) => void;

  private state: PlaybackState = 'idle';
  private currentProgress: number = 0; // 0 to 1
  private currentPath: CameraPath | null = null;
  private evaluator: PathTrajectoryEvaluator | null = null;

  private isLooping: boolean = false;
  private isReversed: boolean = false;

  private onProgressCallback?: PlaybackProgressCallback;
  private onStateChangeCallback?: (state: PlaybackState) => void;

  // Camera Snapshot before preview started
  private cameraSnapshot: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    target: THREE.Vector3;
  } | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    setControlsTarget: (target: THREE.Vector3) => void,
    setControlsEnabled: (enabled: boolean) => void
  ) {
    this.camera = camera;
    this.setControlsTarget = setControlsTarget;
    this.setControlsEnabled = setControlsEnabled;
  }

  public setCallbacks(
    onProgress: PlaybackProgressCallback,
    onStateChange: (state: PlaybackState) => void
  ): void {
    this.onProgressCallback = onProgress;
    this.onStateChangeCallback = onStateChange;
  }

  public play(path: CameraPath, evaluator: PathTrajectoryEvaluator, startProgress: number = 0): void {
    if (this.state === 'idle') {
      // Save Snapshot of editor camera
      this.cameraSnapshot = {
        position: this.camera.position.clone(),
        quaternion: this.camera.quaternion.clone(),
        target: new THREE.Vector3().copy(this.camera.position).add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5)),
      };
    }

    this.currentPath = path;
    this.evaluator = evaluator;
    this.currentProgress = startProgress;
    this.setState('playing');

    // Disable OrbitControls during preview playback
    this.setControlsEnabled(false);
  }

  public pause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.setState('playing');
    }
  }

  public stop(): void {
    this.setState('idle');
    this.currentProgress = 0;

    // Restore editor camera snapshot cleanly
    if (this.cameraSnapshot) {
      this.camera.position.copy(this.cameraSnapshot.position);
      this.camera.quaternion.copy(this.cameraSnapshot.quaternion);
      this.setControlsTarget(this.cameraSnapshot.target);
      this.cameraSnapshot = null;
    }

    // Re-enable OrbitControls
    this.setControlsEnabled(true);

    if (this.currentPath) {
      this.onProgressCallback?.(0, 0, this.currentPath.durationSeconds);
    }
  }

  public seek(progress: number): void {
    this.currentProgress = Math.max(0, Math.min(1, progress));
    if (this.currentPath && this.evaluator) {
      this.applyFrame(this.currentProgress);
      const currentTime = this.currentProgress * this.currentPath.durationSeconds;
      this.onProgressCallback?.(this.currentProgress, currentTime, this.currentPath.durationSeconds);
    }
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  public isLoop(): boolean {
    return this.isLooping;
  }

  public setReverse(reverse: boolean): void {
    this.isReversed = reverse;
  }

  public isReverse(): boolean {
    return this.isReversed;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public finish(endProgress: number = 1): void {
    this.currentProgress = endProgress;
    this.applyFrame(endProgress);
    this.setState('idle');
    this.setControlsEnabled(true);
    // Retain camera at destination view without restoring previous snapshot
    this.cameraSnapshot = null;
    if (this.currentPath) {
      const currentTime = endProgress * this.currentPath.durationSeconds;
      this.onProgressCallback?.(endProgress, currentTime, this.currentPath.durationSeconds);
    }
  }

  public update(delta: number): void {
    if (this.state !== 'playing' || !this.currentPath || !this.evaluator) return;

    const totalDuration = Math.max(0.5, this.currentPath.durationSeconds || 8.0);
    const step = delta / totalDuration;

    if (this.isReversed) {
      this.currentProgress -= step;
      if (this.currentProgress <= 0) {
        if (this.isLooping) {
          this.currentProgress = 1;
        } else {
          this.finish(0);
          return;
        }
      }
    } else {
      this.currentProgress += step;
      if (this.currentProgress >= 1) {
        if (this.isLooping) {
          this.currentProgress = 0;
        } else {
          this.finish(1);
          return;
        }
      }
    }

    this.applyFrame(this.currentProgress);

    const currentTime = this.currentProgress * totalDuration;
    this.onProgressCallback?.(this.currentProgress, currentTime, totalDuration);
  }

  private applyFrame(u: number): void {
    if (!this.evaluator || !this.currentPath) return;

    const transform = this.evaluator.evaluateAt(u, this.currentPath);
    if (transform) {
      this.camera.position.set(transform.position.x, transform.position.y, transform.position.z);
      if (transform.quaternion) {
        this.camera.quaternion.set(
          transform.quaternion.x,
          transform.quaternion.y,
          transform.quaternion.z,
          transform.quaternion.w
        );
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const targetVec = this.camera.position.clone().addScaledVector(forward, 5.0);
        this.setControlsTarget(targetVec);
      } else {
        const targetVec = new THREE.Vector3(transform.target.x, transform.target.y, transform.target.z);
        this.camera.lookAt(targetVec);
        this.setControlsTarget(targetVec);
      }
    }
  }

  private setState(state: PlaybackState): void {
    this.state = state;
    this.onStateChangeCallback?.(state);
  }
}
