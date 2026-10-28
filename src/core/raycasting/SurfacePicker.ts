import * as THREE from 'three';

export interface PickResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
  distance: number;
}

export class SurfacePicker {
  private raycaster: THREE.Raycaster;
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  public pickSurface(
    clientX: number,
    clientY: number,
    camera: THREE.PerspectiveCamera,
    targetRoot: THREE.Object3D,
    containerRect: DOMRect
  ): PickResult | null {
    this.mouseVec.x = ((clientX - containerRect.left) / containerRect.width) * 2 - 1;
    this.mouseVec.y = -((clientY - containerRect.top) / containerRect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, camera);

    const intersects = this.raycaster.intersectObjects(targetRoot.children, true);

    for (const hit of intersects) {
      if ((hit.object as THREE.Mesh).isMesh && hit.point) {
        let normal = new THREE.Vector3(0, 1, 0);
        if (hit.face) {
          normal.copy(hit.face.normal).applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()));
        }

        return {
          point: hit.point,
          normal,
          mesh: hit.object as THREE.Mesh,
          distance: hit.distance,
        };
      }
    }

    return null;
  }
}
