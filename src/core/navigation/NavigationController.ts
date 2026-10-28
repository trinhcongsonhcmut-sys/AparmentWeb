import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraTween } from './CameraTween';

export type NavMode = 'orbit' | 'walk';

export class NavigationController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  public orbitControls: OrbitControls;
  public cameraTween: CameraTween;

  private mode: NavMode = 'orbit';
  private moveSpeed: number = 5.0; // units per second
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;

  private isPointerDown = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  private defaultPosition = new THREE.Vector3(8, 6, 10);
  private defaultTarget = new THREE.Vector3(0, 0, 0);

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // OrbitControls setup
    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.maxDistance = 500;
    this.orbitControls.minDistance = 0.2;
    this.orbitControls.maxPolarAngle = Math.PI - 0.05;

    // Camera Tween
    this.cameraTween = new CameraTween(
      this.camera,
      () => this.orbitControls.target,
      (target) => this.orbitControls.target.copy(target)
    );

    this.bindEvents();
  }

  public setMode(newMode: NavMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;

    if (newMode === 'walk') {
      this.orbitControls.enabled = false;
      this.euler.setFromQuaternion(this.camera.quaternion);
    } else {
      this.orbitControls.enabled = true;
      // Recenter target forward from camera
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.orbitControls.target.copy(this.camera.position).addScaledVector(dir, 5);
      this.orbitControls.update();
    }
  }

  public getMode(): NavMode {
    return this.mode;
  }

  public setSpeed(speed: number): void {
    this.moveSpeed = Math.max(0.5, Math.min(speed, 20));
  }

  public setDefaultView(position: THREE.Vector3, target: THREE.Vector3): void {
    this.defaultPosition.copy(position);
    this.defaultTarget.copy(target);
  }

  public resetCamera(): void {
    this.cameraTween.animateTo(this.defaultPosition, this.defaultTarget, {
      duration: 700,
    });
  }

  public focusHotspot(position: THREE.Vector3, offsetDist: number = 3.5): void {
    // Compute camera offset along current view angle
    const dir = new THREE.Vector3()
      .subVectors(this.camera.position, this.orbitControls.target)
      .normalize();

    if (dir.lengthSq() < 0.001) {
      dir.set(0.6, 0.5, 0.6).normalize();
    }

    const newCamPos = new THREE.Vector3()
      .copy(position)
      .addScaledVector(dir, offsetDist);

    this.cameraTween.animateTo(newCamPos, position, { duration: 600 });
  }

  public focusBounds(box: THREE.Box3): void {
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDist *= 1.35; // Margin factor

    const offset = new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(cameraDist);
    const newPos = new THREE.Vector3().addVectors(center, offset);

    this.setDefaultView(newPos, center);
    this.cameraTween.animateTo(newPos, center, { duration: 800 });
  }

  public update(delta: number): void {
    this.cameraTween.update();

    if (this.mode === 'orbit') {
      this.orbitControls.update();
    } else if (this.mode === 'walk') {
      this.updateWalkMode(delta);
    }
  }

  private updateWalkMode(delta: number): void {
    const actualSpeed = this.moveSpeed * delta;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.camera.getWorldDirection(forward);
    forward.y = 0; // Keep horizontal
    forward.normalize();

    right.crossVectors(forward, this.camera.up).normalize();

    if (this.moveForward) this.camera.position.addScaledVector(forward, actualSpeed);
    if (this.moveBackward) this.camera.position.addScaledVector(forward, -actualSpeed);
    if (this.moveRight) this.camera.position.addScaledVector(right, actualSpeed);
    if (this.moveLeft) this.camera.position.addScaledVector(right, -actualSpeed);
    if (this.moveUp) this.camera.position.y += actualSpeed;
    if (this.moveDown) this.camera.position.y -= actualSpeed;
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Only capture navigation keys if not typing in an input
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    if (this.mode === 'walk') {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = true;
          break;
        case 'KeyE':
        case 'Space':
          this.moveUp = true;
          break;
        case 'KeyQ':
        case 'ShiftLeft':
          this.moveDown = true;
          break;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.mode === 'walk') {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = false;
          break;
        case 'KeyE':
        case 'Space':
          this.moveUp = false;
          break;
        case 'KeyQ':
        case 'ShiftLeft':
          this.moveDown = false;
          break;
      }
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.mode === 'walk' && (e.button === 0 || e.button === 2)) {
      this.isPointerDown = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.mode === 'walk' && this.isPointerDown) {
      const deltaX = e.clientX - this.prevMouseX;
      const deltaY = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      const sensitivity = 0.0025;
      this.euler.y -= deltaX * sensitivity;
      this.euler.x -= deltaY * sensitivity;
      this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    }
  };

  private onMouseUp = (): void => {
    this.isPointerDown = false;
  };
}
