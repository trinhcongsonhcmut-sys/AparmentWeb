import * as THREE from 'three';
import { MathUtils } from '../../shared/math/MathUtils';
import { ModelInfoMeta } from '../../modules/config/types/config.types';

export class ModelFingerprint {
  public static compute(
    model: THREE.Object3D,
    fileInfo: { name: string; size: number; format: 'glb' | 'gltf' | 'usdz' | 'unknown' }
  ): ModelInfoMeta {
    let vertexCount = 0;
    let meshCount = 0;
    const hierarchyTokens: string[] = [];

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          const positions = mesh.geometry.attributes.position;
          if (positions) {
            vertexCount += positions.count;
          }
        }
      }
      hierarchyTokens.push(child.name || child.type);
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    }

    const payload = `${fileInfo.name}_${fileInfo.size}_${meshCount}_${vertexCount}_${MathUtils.round(
      size.x,
      1
    )}_${MathUtils.round(size.y, 1)}_${MathUtils.round(size.z, 1)}_${hierarchyTokens
      .slice(0, 15)
      .join(',')}`;

    const fingerprint = MathUtils.simpleHash(payload);

    return {
      fileName: fileInfo.name,
      format: fileInfo.format,
      fileSize: fileInfo.size,
      fingerprint,
      boundsCenter: MathUtils.roundVector(center, 2),
      boundsSize: MathUtils.roundVector(size, 2),
      vertexCount,
      meshCount,
    };
  }

  public static isCompatible(current: ModelInfoMeta, target: ModelInfoMeta): boolean {
    if (current.fingerprint === target.fingerprint) {
      return true;
    }
    // Secondary check: if filename and format match and dimensions are within 5%
    if (
      current.fileName === target.fileName &&
      current.format === target.format &&
      Math.abs(current.boundsSize.x - target.boundsSize.x) < 0.5 &&
      Math.abs(current.boundsSize.y - target.boundsSize.y) < 0.5
    ) {
      return true;
    }
    return false;
  }
}
