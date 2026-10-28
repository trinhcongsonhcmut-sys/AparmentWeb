import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type GizmoMode = 'translate' | 'rotate';

export interface GizmoCallbacks {
  onDragStart?: () => void;
  onDrag?: (pos: THREE.Vector3, rot: THREE.Euler) => void;
  onDragEnd?: (
    prevPos: THREE.Vector3,
    prevRot: THREE.Euler,
    newPos: THREE.Vector3,
    newRot: THREE.Euler
  ) => void;
}

export class TransformGizmoManager {
  public controls: TransformControls;
  private attachedObject: THREE.Object3D | null = null;
  private startPosition: THREE.Vector3 = new THREE.Vector3();
  private startRotation: THREE.Euler = new THREE.Euler();
  private callbacks: GizmoCallbacks = {};

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    scene: THREE.Scene,
    orbitControls: OrbitControls,
    callbacks: GizmoCallbacks
  ) {
    this.callbacks = callbacks;
    this.controls = new TransformControls(camera, domElement);
    this.controls.size = 0.85;
    this.controls.setSpace('world');

    // Add gizmo helper to scene
    scene.add(this.controls.getHelper());

    // Disable OrbitControls during dragging
    this.controls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
      if (event.value) {
        if (this.attachedObject) {
          this.startPosition.copy(this.attachedObject.position);
          this.startRotation.copy(this.attachedObject.rotation);
        }
        this.callbacks.onDragStart?.();
      } else {
        if (this.attachedObject) {
          this.callbacks.onDragEnd?.(
            this.startPosition.clone(),
            this.startRotation.clone(),
            this.attachedObject.position.clone(),
            this.attachedObject.rotation.clone()
          );
        }
      }
    });

    // Fire onDrag event
    this.controls.addEventListener('objectChange', () => {
      if (this.attachedObject) {
        this.callbacks.onDrag?.(this.attachedObject.position, this.attachedObject.rotation);
      }
    });
  }

  public attach(obj: THREE.Object3D): void {
    this.attachedObject = obj;
    this.controls.attach(obj);
    this.controls.enabled = true;
  }

  public detach(): void {
    this.controls.detach();
    this.attachedObject = null;
    this.controls.enabled = false;
  }

  public setMode(mode: GizmoMode): void {
    this.controls.setMode(mode);
  }

  public setSnap(snapTranslation: number | null, snapRotationDeg: number | null): void {
    this.controls.setTranslationSnap(snapTranslation);
    this.controls.setRotationSnap(
      snapRotationDeg !== null ? THREE.MathUtils.degToRad(snapRotationDeg) : null
    );
  }

  public isDragging(): boolean {
    return this.controls.dragging;
  }
}
