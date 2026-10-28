import * as THREE from 'three';
import { CameraPath, CameraWaypoint } from '../types/cameraPath.types';
import { HotspotItem } from '../../hotspots/types/hotspot.types';
import { PathTrajectoryEvaluator } from '../services/PathTrajectoryEvaluator';

export class Path3DVisualizer {
  private scene: THREE.Scene;
  private pathGroup: THREE.Group;
  private waypointGroup: THREE.Group;
  private curveMesh: THREE.Line | null = null;
  private arrowHelpers: THREE.ArrowHelper[] = [];
  private waypointAnchors: Map<string, THREE.Object3D> = new Map();

  private onSelectWaypoint?: (wpId: string) => void;

  constructor(scene: THREE.Scene, onSelectWaypoint?: (wpId: string) => void) {
    this.scene = scene;
    this.onSelectWaypoint = onSelectWaypoint;

    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'CameraPathVisualizerGroup';
    this.scene.add(this.pathGroup);

    this.waypointGroup = new THREE.Group();
    this.waypointGroup.name = 'CameraWaypointsGroup';
    this.scene.add(this.waypointGroup);
  }

  public updateVisuals(
    path: CameraPath | null,
    evaluator: PathTrajectoryEvaluator,
    waypoints: CameraWaypoint[],
    selectedWaypointId: string | null,
    fromHotspot?: HotspotItem,
    toHotspot?: HotspotItem
  ): void {
    this.clearVisuals();

    if (!path) return;

    // 1. Draw 3D Curve Line
    const points = evaluator.getSpacedPoints(120);
    if (points.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x8b5cf6, // Violet glowing trajectory
        linewidth: 3,
        depthTest: true,
      });

      this.curveMesh = new THREE.Line(geometry, material);
      this.pathGroup.add(this.curveMesh);

      // Add directional arrows at 25%, 50%, 75%
      const arrowFractions = [0.25, 0.5, 0.75];
      for (const frac of arrowFractions) {
        const p = points[Math.floor(frac * points.length)];
        const nextP = points[Math.min(points.length - 1, Math.floor(frac * points.length) + 1)];
        const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
        if (dir.lengthSq() > 0.001) {
          const arrow = new THREE.ArrowHelper(dir, p, 0.6, 0xf59e0b, 0.25, 0.15);
          this.pathGroup.add(arrow);
          this.arrowHelpers.push(arrow);
        }
      }
    }

    // 2. Render Waypoint 3D Markers
    waypoints.forEach((wp, index) => {
      const anchor = this.createWaypointMarker(wp, index + 1, wp.id === selectedWaypointId);
      this.waypointGroup.add(anchor);
      this.waypointAnchors.set(wp.id, anchor);
    });

    // 3. Render Destination Orientation Pointer at resolved end position
    const resolvedEndPos = evaluator.getResolvedEndPosition(path);
    if (resolvedEndPos) {
      const qEnd = evaluator.getEndQuaternion(path);
      if (qEnd) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qEnd).normalize();
        const endArrow = new THREE.ArrowHelper(
          forward,
          resolvedEndPos,
          1.2,
          0x00e5ff, // Vibrant Cyan
          0.35,
          0.2
        );
        endArrow.name = 'EndOrientationArrow';
        this.pathGroup.add(endArrow);
        this.arrowHelpers.push(endArrow);
      }

      // If position is customized and differs from hotspot, draw dashed connecting link
      if (toHotspot) {
        const hPos = new THREE.Vector3(toHotspot.position.x, toHotspot.position.y, toHotspot.position.z);
        if (hPos.distanceTo(resolvedEndPos) > 0.05) {
          const linkGeo = new THREE.BufferGeometry().setFromPoints([resolvedEndPos, hPos]);
          const linkMat = new THREE.LineDashedMaterial({
            color: 0xc4b5fd,
            dashSize: 0.15,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.7,
          });
          const linkLine = new THREE.Line(linkGeo, linkMat);
          linkLine.computeLineDistances();
          this.pathGroup.add(linkLine);
        }
      }
    }
  }

  private createWaypointMarker(
    wp: CameraWaypoint,
    orderNumber: number,
    isSelected: boolean
  ): THREE.Object3D {
    const anchor = new THREE.Group();
    anchor.name = `WaypointAnchor_${wp.id}`;
    anchor.position.set(wp.position.x, wp.position.y, wp.position.z);
    anchor.userData = { waypointId: wp.id };

    // Marker Body: Octahedron / Diamond shape
    const geom = new THREE.OctahedronGeometry(0.25);
    const mat = new THREE.MeshStandardMaterial({
      color: isSelected ? 0x00e5ff : 0xf59e0b, // Cyan if selected, Amber if normal
      roughness: 0.3,
      metalness: 0.7,
      emissive: isSelected ? 0x00e5ff : 0x78350f,
      emissiveIntensity: isSelected ? 0.6 : 0.2,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    anchor.add(mesh);

    // Orientation view direction cone/arrow
    const orientationMode = wp.orientation?.mode || 'followPath';
    let lookDir = new THREE.Vector3(0, 0, 1);

    if (orientationMode === 'manual' && wp.orientation?.yaw !== undefined) {
      const yawRad = THREE.MathUtils.degToRad(wp.orientation.yaw || 0);
      const pitchRad = THREE.MathUtils.degToRad(wp.orientation.pitch || 0);
      lookDir.set(
        -Math.sin(yawRad) * Math.cos(pitchRad),
        Math.sin(pitchRad),
        -Math.cos(yawRad) * Math.cos(pitchRad)
      ).normalize();
    } else if (orientationMode === 'lookAt' && wp.orientation?.lookAtTarget) {
      lookDir.subVectors(
        new THREE.Vector3(wp.orientation.lookAtTarget.x, wp.orientation.lookAtTarget.y, wp.orientation.lookAtTarget.z),
        anchor.position
      ).normalize();
    }

    // Small forward pointer arrow
    const viewArrow = new THREE.ArrowHelper(lookDir, new THREE.Vector3(0, 0, 0), 0.5, 0x10b981, 0.15, 0.1);
    anchor.add(viewArrow);

    return anchor;
  }

  public getAnchor(waypointId: string): THREE.Object3D | undefined {
    return this.waypointAnchors.get(waypointId);
  }

  public setVisible(visible: boolean): void {
    this.pathGroup.visible = visible;
    this.waypointGroup.visible = visible;
  }

  public clearVisuals(): void {
    while (this.pathGroup.children.length > 0) {
      const child = this.pathGroup.children[0];
      this.pathGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) (child as any).material.dispose();
    }

    while (this.waypointGroup.children.length > 0) {
      const child = this.waypointGroup.children[0];
      this.waypointGroup.remove(child);
      child.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const m = node as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) (m.material as any).dispose();
        }
      });
    }

    this.curveMesh = null;
    this.arrowHelpers = [];
    this.waypointAnchors.clear();
  }

  public dispose(): void {
    this.clearVisuals();
    this.scene.remove(this.pathGroup);
    this.scene.remove(this.waypointGroup);
  }
}
