import * as THREE from 'three';

export interface TweenOptions {
  duration?: number;
  onUpdate?: () => void;
  onComplete?: () => void;
}

export class CameraTween {
  private isAnimating: boolean = false;
  private startTime: number = 0;
  private duration: number = 800; // ms

  private startPos: THREE.Vector3 = new THREE.Vector3();
  private endPos: THREE.Vector3 = new THREE.Vector3();
  private startTarget: THREE.Vector3 = new THREE.Vector3();
  private endTarget: THREE.Vector3 = new THREE.Vector3();

  private camera: THREE.PerspectiveCamera;
  private getControlsTarget: () => THREE.Vector3;
  private setControlsTarget: (target: THREE.Vector3) => void;
  private onCompleteCallback?: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    getControlsTarget: () => THREE.Vector3,
    setControlsTarget: (target: THREE.Vector3) => void
  ) {
    this.camera = camera;
    this.getControlsTarget = getControlsTarget;
    this.setControlsTarget = setControlsTarget;
  }

  public animateTo(
    targetCameraPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    options?: TweenOptions
  ): void {
    this.duration = options?.duration ?? 800;
    this.onCompleteCallback = options?.onComplete;

    this.startPos.copy(this.camera.position);
    this.endPos.copy(targetCameraPos);

    this.startTarget.copy(this.getControlsTarget());
    this.endTarget.copy(targetLookAt);

    this.startTime = performance.now();
    this.isAnimating = true;
  }

  public update(): void {
    if (!this.isAnimating) return;

    const now = performance.now();
    const elapsed = now - this.startTime;
    let progress = Math.min(elapsed / this.duration, 1);

    // Ease In-Out Cubic
    const ease =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    this.camera.position.lerpVectors(this.startPos, this.endPos, ease);

    const currentTarget = new THREE.Vector3().lerpVectors(
      this.startTarget,
      this.endTarget,
      ease
    );
    this.setControlsTarget(currentTarget);
    this.camera.lookAt(currentTarget);

    if (progress >= 1) {
      this.isAnimating = false;
      this.camera.position.copy(this.endPos);
      this.setControlsTarget(this.endTarget);
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
    }
  }

  public stop(): void {
    this.isAnimating = false;
  }
}
