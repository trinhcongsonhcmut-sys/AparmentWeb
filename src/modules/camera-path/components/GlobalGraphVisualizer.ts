import * as THREE from 'three';
import type { CameraWaypoint } from '../types/cameraPath.types.ts';
import type { WaypointEdge } from '../types/waypointGraph.types.ts';

export class GlobalGraphVisualizer {
  private scene: THREE.Scene;
  private rootGroup: THREE.Group;
  private waypointGroup: THREE.Group;
  private edgeGroup: THREE.Group;
  private highlightGroup: THREE.Group;

  private waypointMeshes: Map<string, THREE.Mesh> = new Map();
  private edgeLines: Map<string, THREE.Line> = new Map();
  private edgeEndPoints: Map<string, { pA: THREE.Vector3; pB: THREE.Vector3 }> = new Map();
  private arrowHelpers: THREE.ArrowHelper[] = [];

  private isVisible: boolean = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'GlobalWaypointGraphVisualizer';
    this.scene.add(this.rootGroup);

    this.waypointGroup = new THREE.Group();
    this.waypointGroup.name = 'GraphWaypointsGroup';
    this.rootGroup.add(this.waypointGroup);

    this.edgeGroup = new THREE.Group();
    this.edgeGroup.name = 'GraphEdgesGroup';
    this.rootGroup.add(this.edgeGroup);

    this.highlightGroup = new THREE.Group();
    this.highlightGroup.name = 'GraphHighlightGroup';
    this.rootGroup.add(this.highlightGroup);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.rootGroup.visible = visible;
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public toggleVisible(): boolean {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  public clear(clearRouteHighlight: boolean = false): void {
    while (this.waypointGroup.children.length > 0) {
      const child = this.waypointGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      this.waypointGroup.remove(child);
    }

    while (this.edgeGroup.children.length > 0) {
      const child = this.edgeGroup.children[0] as THREE.Line;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      this.edgeGroup.remove(child);
    }

    if (clearRouteHighlight) {
      this.clearHighlights();
    }
    this.arrowHelpers = [];
    this.waypointMeshes.clear();
    this.edgeLines.clear();
    this.edgeEndPoints.clear();
  }

  public clearHighlights(): void {
    while (this.highlightGroup.children.length > 0) {
      const child = this.highlightGroup.children[0] as THREE.Object3D;
      this.highlightGroup.remove(child);
    }
  }

  public updateVisuals(
    waypoints: CameraWaypoint[],
    edges: WaypointEdge[],
    selectedWaypointId: string | null,
    selectedEdgeId: string | null,
    isolatedWaypointIds: string[] = []
  ): void {
    this.clear(false); // Preserve route highlights during visual updates

    const wpMap = new Map(waypoints.map((w) => [w.id, w]));
    const isolatedSet = new Set(isolatedWaypointIds);

    // 1. Render Edges
    for (const edge of edges) {
      const wpA = wpMap.get(edge.fromWaypointId);
      const wpB = wpMap.get(edge.toWaypointId);
      if (!wpA || !wpB) continue;

      const pA = new THREE.Vector3(wpA.position.x, wpA.position.y, wpA.position.z);
      const pB = new THREE.Vector3(wpB.position.x, wpB.position.y, wpB.position.z);

      const isSelected = edge.id === selectedEdgeId;
      const points = [pA, pB];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      // Color coding by status
      let edgeColor = 0x10b981; // Valid = emerald
      if (edge.status === 'blocked') edgeColor = 0xef4444; // Blocked = red
      else if (edge.status === 'needs_confirmation') edgeColor = 0xf59e0b; // Needs confirmation = amber
      else if (edge.status === 'untested') edgeColor = 0x94a3b8; // Untested = silver

      if (isSelected) {
        edgeColor = 0x38bdf8; // Selected = neon cyan
      }

      let material: THREE.Material;
      if (edge.status === 'blocked' || edge.status === 'needs_confirmation') {
        material = new THREE.LineDashedMaterial({
          color: edgeColor,
          dashSize: 0.3,
          gapSize: 0.15,
          linewidth: isSelected ? 3 : 2,
        });
      } else {
        material = new THREE.LineBasicMaterial({
          color: edgeColor,
          linewidth: isSelected ? 4 : 2,
        });
      }

      const line = new THREE.Line(geometry, material);
      if (edge.status === 'blocked' || edge.status === 'needs_confirmation') {
        line.computeLineDistances();
      }

      line.userData = { type: 'waypoint_edge', edgeId: edge.id };
      this.edgeGroup.add(line);
      this.edgeLines.set(edge.id, line);
      this.edgeEndPoints.set(edge.id, { pA: pA.clone(), pB: pB.clone() });

      // Add a distinct glowing highlight cylinder if this edge is selected
      if (isSelected) {
        const seg = new THREE.Vector3().subVectors(pB, pA);
        const segLen = seg.length();
        if (segLen > 0.001) {
          const midPoint = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
          const cylGeo = new THREE.CylinderGeometry(0.05, 0.05, segLen, 8);
          const cylMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.6,
            depthTest: false,
          });
          const cyl = new THREE.Mesh(cylGeo, cylMat);
          cyl.position.copy(midPoint);
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.clone().normalize());
          cyl.renderOrder = 9999;
          this.edgeGroup.add(cyl);
        }
      }

      // Add directional arrow if unidirectional
      if (edge.direction === 'unidirectional') {
        const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
        const midPoint = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        if (dir.lengthSq() > 0.001) {
          const arrow = new THREE.ArrowHelper(dir, midPoint, 0.5, edgeColor, 0.25, 0.15);
          this.edgeGroup.add(arrow);
          this.arrowHelpers.push(arrow);
        }
      }
    }

    // 2. Render Waypoint Spheres / Markers
    for (const wp of waypoints) {
      if (wp.status === 'disabled') continue;

      const isSelected = wp.id === selectedWaypointId;
      const isIsolated = isolatedSet.has(wp.id);

      // Outer Glow / Sphere
      const radius = isSelected ? 0.22 : 0.16;
      const sphereGeo = new THREE.SphereGeometry(radius, 16, 16);

      let color = 0x0ea5e9; // Default active sky blue
      if (isSelected) color = 0xec4899; // Selected magenta
      else if (isIsolated) color = 0xf97316; // Isolated warning orange
      else if (wp.status === 'draft') color = 0x64748b; // Draft slate

      const sphereMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isSelected ? 0.6 : 0.25,
        roughness: 0.3,
        metalness: 0.2,
      });

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(wp.position.x, wp.position.y, wp.position.z);
      sphere.userData = { type: 'global_waypoint', waypointId: wp.id };

      // Add selection ring if selected
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.26, 0.32, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xec4899,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 9998;
        sphere.add(ring);
      }

      this.waypointGroup.add(sphere);
      this.waypointMeshes.set(wp.id, sphere);
    }
  }

  /**
   * Updates only edge geometries connected to a waypoint while dragging (zero mesh recreation)
   */
  public updateEdgeEndpointsForWaypoint(
    waypointId: string,
    newPos: THREE.Vector3,
    edges: WaypointEdge[],
    waypoints: CameraWaypoint[]
  ): void {
    const wpMap = new Map(waypoints.map((w) => [w.id, w]));
    for (const edge of edges) {
      if (edge.fromWaypointId === waypointId || edge.toWaypointId === waypointId) {
        const line = this.edgeLines.get(edge.id);
        if (!line) continue;

        const wpA = wpMap.get(edge.fromWaypointId);
        const wpB = wpMap.get(edge.toWaypointId);
        if (!wpA || !wpB) continue;

        const pA = edge.fromWaypointId === waypointId ? newPos : new THREE.Vector3(wpA.position.x, wpA.position.y, wpA.position.z);
        const pB = edge.toWaypointId === waypointId ? newPos : new THREE.Vector3(wpB.position.x, wpB.position.y, wpB.position.z);

        line.geometry.setFromPoints([pA, pB]);
        line.geometry.attributes.position.needsUpdate = true;
        this.edgeEndPoints.set(edge.id, { pA: pA.clone(), pB: pB.clone() });
        if (edge.status === 'blocked' || edge.status === 'needs_confirmation') {
          line.computeLineDistances();
        }
      }
    }
  }

  /**
   * Highlights the solved route in 3D with glowing golden polyline and nodes
   */
  public highlightRoute(points: THREE.Vector3[]): void {
    this.clearHighlights();

    if (points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const sampled = curve.getPoints(120);

    const geo = new THREE.BufferGeometry().setFromPoints(sampled);
    const mat = new THREE.LineBasicMaterial({
      color: 0xfbbf24, // Bright Gold / Amber (vàng kim)
      linewidth: 6,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });

    const routeLine = new THREE.Line(geo, mat);
    routeLine.name = 'HighlightedRoutePath';
    routeLine.renderOrder = 9999;
    this.highlightGroup.add(routeLine);

    // Add golden waypoint nodes along the route
    const nodeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });

    for (const pt of points) {
      const sp = new THREE.Mesh(nodeGeo, nodeMat);
      sp.position.copy(pt);
      sp.renderOrder = 10000;
      this.highlightGroup.add(sp);
    }
  }

  public getInteractableObjects(): THREE.Object3D[] {
    if (!this.rootGroup.visible) return [];
    return Array.from(this.waypointMeshes.values());
  }

  public getWaypointMesh(id: string): THREE.Mesh | undefined {
    return this.waypointMeshes.get(id);
  }

  /**
   * Raycast picker for graph edges. Allows clicking directly on 3D lines (e.g. red blocked edges)
   */
  public pickEdge(raycaster: THREE.Raycaster): string | null {
    if (!this.rootGroup.visible) return null;

    let closestEdgeId: string | null = null;
    let minForwardDist = Infinity;

    const ptOnRay = new THREE.Vector3();
    const ptOnSeg = new THREE.Vector3();

    for (const [edgeId, pts] of this.edgeEndPoints.entries()) {
      const distSq = raycaster.ray.distanceSqToSegment(pts.pA, pts.pB, ptOnRay, ptOnSeg);

      // Distance from ray origin along the ray direction
      const forwardDist = ptOnRay.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
      if (forwardDist < 0.15 || forwardDist > (raycaster.far || 1000)) continue;

      // Generous hit threshold in 3D perspective: at least 0.22m or ~3.5% of distance from camera
      const hitRadius = Math.max(0.22, forwardDist * 0.035);
      if (distSq <= hitRadius * hitRadius) {
        if (forwardDist < minForwardDist) {
          minForwardDist = forwardDist;
          closestEdgeId = edgeId;
        }
      }
    }

    return closestEdgeId;
  }
}

