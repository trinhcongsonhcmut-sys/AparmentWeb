import * as THREE from 'three';
import { CameraPath, CameraWaypoint } from '../types/cameraPath.types';
import { PathTrajectoryEvaluator } from './PathTrajectoryEvaluator';

export class PathCollisionChecker {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  public checkPath(
    path: CameraPath,
    evaluator: PathTrajectoryEvaluator,
    sceneRoot: THREE.Object3D
  ): string[] {
    const warnings: string[] = [];

    const points = evaluator.getSpacedPoints(30);
    if (points.length < 2) return warnings;

    const meshes: THREE.Mesh[] = [];
    sceneRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.visible) {
        // Exclude ground/floor from wall collision if named floor
        const name = child.name.toLowerCase();
        if (!name.includes('floor') && !name.includes('ground')) {
          meshes.push(child as THREE.Mesh);
        }
      }
    });

    if (meshes.length === 0) return warnings;

    let clippedSegments = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const dist = dir.length();

      if (dist > 0.01) {
        dir.normalize();
        this.raycaster.set(p1, dir);
        this.raycaster.far = dist;

        const hits = this.raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          clippedSegments++;
        }
      }
    }

    if (clippedSegments > 0) {
      warnings.push(`Cảnh báo: Phát hiện ${clippedSegments} vị trí đường đi có thể giao cắt với tường/vật thể.`);
    }

    return warnings;
  }
}
