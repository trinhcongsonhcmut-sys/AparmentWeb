import * as THREE from 'three';
import { CandidateHotspot } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class CandidateDetector {
  private static readonly KEYWORDS =
    /(hotspot|point|nav|marker|poi|view|cam|camera|room|phong|bep|ngu|ban_cong|sanh|cua|entry|living|kitchen|bedroom|bath)/i;

  public static detect(root: THREE.Object3D): CandidateHotspot[] {
    const candidates: CandidateHotspot[] = [];
    const seenPositions: Set<string> = new Set();

    root.traverse((node) => {
      // Avoid checking the root itself
      if (node === root) return;

      let isCandidate = false;
      let nodeType: 'Camera' | 'Empty' | 'Mesh' | 'Metadata' = 'Empty';
      let candidateName = node.name || 'Điểm chưa đặt tên';

      // 1. Check if node is a Camera
      if ((node as any).isCamera) {
        isCandidate = true;
        nodeType = 'Camera';
        candidateName = node.name || 'Góc nhìn Camera';
      }
      // 2. Check if name matches hotspot / room keywords
      else if (node.name && this.KEYWORDS.test(node.name)) {
        isCandidate = true;
        nodeType = (node as THREE.Mesh).isMesh ? 'Mesh' : 'Empty';
        // Clean up internal 3D export prefixes
        candidateName = this.cleanNodeName(node.name);
      }
      // 3. Check node userData for metadata
      else if (node.userData && (node.userData.isHotspot || node.userData.hotspot || node.userData.type === 'hotspot')) {
        isCandidate = true;
        nodeType = 'Metadata';
        candidateName = node.userData.title || node.userData.name || node.name || 'Hotspot Metadata';
      }
      // 4. Check if Empty object with specific transformation
      else if (node.type === 'Object3D' && node.children.length === 0 && !node.name.startsWith('_')) {
        if (node.name.length > 2 && !node.name.toLowerCase().includes('root') && !node.name.toLowerCase().includes('scene')) {
          isCandidate = true;
          nodeType = 'Empty';
        }
      }

      if (isCandidate) {
        const worldPos = new THREE.Vector3();
        node.getWorldPosition(worldPos);

        // Deduplicate identical coordinate candidates
        const posKey = `${MathUtils.round(worldPos.x, 2)}_${MathUtils.round(worldPos.y, 2)}_${MathUtils.round(worldPos.z, 2)}`;
        if (!seenPositions.has(posKey)) {
          seenPositions.add(posKey);

          candidates.push({
            id: MathUtils.generateUUID(),
            name: candidateName,
            nodePath: this.getNodePath(node),
            nodeType,
            position: MathUtils.roundVector(worldPos, 2),
            originalObject: node,
            selected: true,
          });
        }
      }
    });

    return candidates;
  }

  private static cleanNodeName(name: string): string {
    return name
      .replace(/^(hotspot[_\-\s]*|marker[_\-\s]*|poi[_\-\s]*|cam[_\-\s]*)/i, '')
      .replace(/(\.00\d+|_\d+)$/, '')
      .trim() || name;
  }

  private static getNodePath(node: THREE.Object3D): string {
    const parts: string[] = [];
    let curr: THREE.Object3D | null = node;
    while (curr && curr.parent) {
      parts.unshift(curr.name || curr.type);
      curr = curr.parent;
    }
    return parts.join(' > ');
  }
}
