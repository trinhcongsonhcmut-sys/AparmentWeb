import * as THREE from 'three';
import type { CameraPath, CameraWaypoint, WaypointOrientation } from '../types/cameraPath.types';
import type { WaypointEdge } from '../types/waypointGraph.types';
import type { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils.ts';
import { SmoothRotationService } from './SmoothRotationService.ts';

export interface GraphNode {
  id: string;
  name: string;
  position: THREE.Vector3;
  isHotspot: boolean;
  orientation?: WaypointOrientation;
}

export interface GraphEdge {
  fromNodeId: string;
  toNodeId: string;
  distance: number;
}

export interface RouteSearchResult {
  success: boolean;
  mode?: 'direct' | 'graph';
  controlPoints?: THREE.Vector3[];
  curve?: THREE.Curve<THREE.Vector3>;
  targetPosition?: THREE.Vector3;
  targetQuaternion?: THREE.Quaternion;
  durationSeconds?: number;
  waypointsOnRoute?: string[];
  reason?: 'BLOCKED_BY_GEOMETRY' | 'NO_ROUTE_FOUND' | 'SAME_POSITION';
  message?: string;
}

export class CameraPathfindingService {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private smoothRotation: SmoothRotationService = SmoothRotationService.getInstance();

  /**
   * Bi-directional Raycast with clearance radius to verify if segment A-B is clear of walls
   */
  public isLineSafe(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    sceneRoot: THREE.Object3D,
    clearanceRadius: number = 0.15
  ): boolean {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const dist = dir.length();
    if (dist < 0.05) return true;

    sceneRoot.updateMatrixWorld(true);

    // Collect collidable meshes - exclude floors, ceilings, lighting fixtures, and decorative props
    const nonBlockingKeywords = [
      'floor', 'ground', 'grid', 'ceiling', 'roof',
      'lamp', 'light', 'pendant', 'chandelier',
      'rug', 'carpet', 'mat', 'curtain', 'plant', 'leaf', 'leaves', 'pot'
    ];
    const meshes: THREE.Mesh[] = [];
    sceneRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.visible) {
        const name = child.name.toLowerCase();
        const isNonBlocking = nonBlockingKeywords.some((k) => name.includes(k));
        if (!isNonBlocking) {
          meshes.push(child as THREE.Mesh);
        }
      }
    });

    if (meshes.length === 0) return true;

    // 1. Center Ray: P1 -> P2
    dir.normalize();
    this.raycaster.set(p1, dir);
    this.raycaster.far = dist;
    let hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0 && hits[0].distance < dist - 0.08 && hits[0].distance > 0.05) {
      return false;
    }

    // 2. Reverse Center Ray: P2 -> P1 (Catches single-sided backfaces)
    const revDir = dir.clone().negate();
    this.raycaster.set(p2, revDir);
    this.raycaster.far = dist;
    hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0 && hits[0].distance < dist - 0.08 && hits[0].distance > 0.05) {
      return false;
    }

    // 3. Side Clearance Rays (Left & Right offset to avoid scraping walls/doorframes)
    if (clearanceRadius > 0.05) {
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(clearanceRadius);

      if (right.lengthSq() > 0.001) {
        // Left ray
        const p1Left = p1.clone().sub(right);
        this.raycaster.set(p1Left, dir);
        this.raycaster.far = dist;
        const leftHits = this.raycaster.intersectObjects(meshes, false);
        if (leftHits.length > 0 && leftHits[0].distance < dist - 0.08 && leftHits[0].distance > 0.08) {
          return false;
        }

        // Right ray
        const p1Right = p1.clone().add(right);
        this.raycaster.set(p1Right, dir);
        this.raycaster.far = dist;
        const rightHits = this.raycaster.intersectObjects(meshes, false);
        if (rightHits.length > 0 && rightHits[0].distance < dist - 0.08 && rightHits[0].distance > 0.08) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Builds the in-memory Navigation Graph from existing Hotspots, Waypoints, and CameraPaths
   */
  public buildNavigationGraph(
    hotspots: HotspotItem[],
    waypoints: CameraWaypoint[],
    paths: CameraPath[],
    sceneRoot?: THREE.Object3D,
    edges?: WaypointEdge[]
  ): { nodes: Map<string, GraphNode>; adjacency: Map<string, GraphEdge[]> } {
    const nodes = new Map<string, GraphNode>();
    const adjacency = new Map<string, GraphEdge[]>();

    const addEdge = (fromId: string, toId: string, dist: number) => {
      if (!adjacency.has(fromId)) adjacency.set(fromId, []);
      adjacency.get(fromId)!.push({ fromNodeId: fromId, toNodeId: toId, distance: dist });
    };

    // 1. Add Hotspots as Nodes
    for (const h of hotspots) {
      nodes.set(h.id, {
        id: h.id,
        name: h.name,
        position: new THREE.Vector3(h.position.x, h.position.y, h.position.z),
        isHotspot: true,
      });
      if (!adjacency.has(h.id)) adjacency.set(h.id, []);
    }

    // 2. Add Waypoints as Nodes
    for (const wp of waypoints) {
      if (wp.status === 'disabled') continue;
      nodes.set(wp.id, {
        id: wp.id,
        name: wp.name,
        position: new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z),
        isHotspot: false,
        orientation: wp.orientation,
      });
      if (!adjacency.has(wp.id)) adjacency.set(wp.id, []);
    }

    // 3. Add Edges from Global Waypoint Graph
    if (edges && edges.length > 0) {
      for (const edge of edges) {
        if (edge.status === 'blocked' && !edge.confirmedByAdmin) continue;
        if (!nodes.has(edge.fromWaypointId) || !nodes.has(edge.toWaypointId)) continue;

        const cost = edge.distance * (edge.costWeight !== undefined ? edge.costWeight : 1.0);
        addEdge(edge.fromWaypointId, edge.toWaypointId, cost);
        if (edge.direction === 'bidirectional') {
          addEdge(edge.toWaypointId, edge.fromWaypointId, cost);
        }
      }
    }

    // 4. Add Edges from configured CameraPaths (backward compatibility)
    for (const path of paths) {
      if (path.enabled === false) continue;

      const chain: string[] = [];
      if (nodes.has(path.fromHotspotId)) chain.push(path.fromHotspotId);
      for (const wpId of path.waypointIds) {
        if (nodes.has(wpId)) chain.push(wpId);
      }
      if (nodes.has(path.toHotspotId)) chain.push(path.toHotspotId);

      for (let i = 0; i < chain.length - 1; i++) {
        const idA = chain[i];
        const idB = chain[i + 1];
        const posA = nodes.get(idA)!.position;
        const posB = nodes.get(idB)!.position;
        const d = posA.distanceTo(posB);

        addEdge(idA, idB, d);
        // By default, graph connections are bidirectional for flexible navigation
        addEdge(idB, idA, d);
      }
    }

    // 5. Connect nearby waypoints with clear Line-of-Sight if no explicit edges provided
    if (sceneRoot && (!edges || edges.length === 0)) {
      const wpList = Array.from(nodes.values()).filter((n) => !n.isHotspot);
      for (let i = 0; i < wpList.length; i++) {
        for (let j = i + 1; j < wpList.length; j++) {
          const w1 = wpList[i];
          const w2 = wpList[j];
          const d = w1.position.distanceTo(w2.position);

          // If within 6m and line is safe, connect them
          if (d <= 6.0 && this.isLineSafe(w1.position, w2.position, sceneRoot, 0.25)) {
            addEdge(w1.id, w2.id, d);
            addEdge(w2.id, w1.id, d);
          }
        }
      }
    }

    return { nodes, adjacency };
  }

  /**
   * Resolves the target camera position for a hotspot (avoiding placing camera on floor)
   */
  public resolveHotspotCameraPosition(
    hotspot: HotspotItem,
    associatedPath?: CameraPath
  ): THREE.Vector3 {
    // 1. Primary Source of Truth: Hotspot cameraView custom position
    if (hotspot.cameraView?.useCustomPosition && hotspot.cameraView.cameraPosition) {
      const p = hotspot.cameraView.cameraPosition;
      return new THREE.Vector3(p.x, p.y, p.z);
    }

    // 2. Legacy fallback from incoming CameraPath
    if (
      associatedPath &&
      (associatedPath.useCustomEndPosition || associatedPath.endOrientation?.useCustomPosition) &&
      (associatedPath.endPosition || associatedPath.endOrientation?.position)
    ) {
      const p = associatedPath.endPosition || associatedPath.endOrientation!.position!;
      return new THREE.Vector3(p.x, p.y, p.z);
    }

    // Standard human eye height offset for floor hotspots
    const isFloorLevel = hotspot.position.y < 1.0;
    const yEye = isFloorLevel ? 1.6 : hotspot.position.y;

    return new THREE.Vector3(hotspot.position.x, yEye, hotspot.position.z);
  }

  /**
   * Converts Euler angles (Yaw, Pitch, Roll in degrees) to a stable THREE.Quaternion
   */
  public eulerToQuaternion(yawDeg: number, pitchDeg: number, rollDeg: number = 0): THREE.Quaternion {
    return this.smoothRotation.eulerToQuaternion(yawDeg, pitchDeg, rollDeg);
  }

  /**
   * Finds the optimal, collision-free route from current camera state to destination hotspot
   */
  public findOptimalRoute(
    cameraPos: THREE.Vector3,
    cameraQuat: THREE.Quaternion,
    destHotspot: HotspotItem,
    hotspots: HotspotItem[],
    waypoints: CameraWaypoint[],
    paths: CameraPath[],
    sceneRoot: THREE.Object3D,
    edges?: WaypointEdge[]
  ): RouteSearchResult {
    // Single Source of Truth: Always resolve the destination hotspot from the latest hotspots array
    const targetHotspot = hotspots.find((h) => h.id === destHotspot.id) || destHotspot;
    const pStart = cameraPos.clone();

    // Find if there is an existing path ending at targetHotspot
    const incomingPath = paths.find((p) => p.toHotspotId === targetHotspot.id);
    const pDest = this.resolveHotspotCameraPosition(targetHotspot, incomingPath);

    // Target orientation: Single Source of Truth is destination Hotspot
    let qDest: THREE.Quaternion;
    if (targetHotspot.cameraView?.configured) {
      qDest = this.eulerToQuaternion(
        targetHotspot.cameraView.yaw || 0,
        targetHotspot.cameraView.pitch || 0,
        targetHotspot.cameraView.roll || 0
      );
    } else if (targetHotspot.rotation && (targetHotspot.rotation.x !== 0 || targetHotspot.rotation.y !== 0)) {
      qDest = this.eulerToQuaternion(
        targetHotspot.rotation.y || 0,
        targetHotspot.rotation.x || 0,
        targetHotspot.rotation.z || 0
      );
    } else if (incomingPath?.endOrientation?.mode === 'custom' && incomingPath.endOrientation.yaw !== undefined) {
      qDest = this.eulerToQuaternion(
        incomingPath.endOrientation.yaw,
        incomingPath.endOrientation.pitch || 0,
        incomingPath.endOrientation.roll || 0
      );
    } else {
      // Unconfigured orientation: maintain current camera orientation (free viewport view)
      qDest = cameraQuat.clone();
    }

    // Check if camera is already at destination
    const totalDistDirect = pStart.distanceTo(pDest);
    if (totalDistDirect < 0.1) {
      return {
        success: true,
        mode: 'direct',
        controlPoints: [pStart, pDest],
        targetPosition: pDest,
        targetQuaternion: qDest,
        durationSeconds: 0.5,
      };
    }

    // --- STEP 1: DIRECT LINE-OF-SIGHT CHECK ---
    // If destination is in the same room / short distance and line is unobstructed
    if (totalDistDirect <= 7.0 && this.isLineSafe(pStart, pDest, sceneRoot, 0.25)) {
      const directDir = pDest.clone().sub(pStart).normalize();
      const directTangentQuat = this.smoothRotation.directionToQuaternion(directDir);
      const angleDiff = this.smoothRotation.computeAngularDistance(directTangentQuat, qDest);
      const minRotTime = angleDiff / THREE.MathUtils.degToRad(180);
      const dur = Math.max(1.5, Math.min(6.0, Math.max(totalDistDirect / 3.0, minRotTime / 0.65)));

      return {
        success: true,
        mode: 'direct',
        controlPoints: [pStart, pDest],
        targetPosition: pDest,
        targetQuaternion: qDest,
        durationSeconds: dur,
      };
    }

    // --- STEP 2: BUILD NAVIGATION GRAPH ---
    const { nodes, adjacency } = this.buildNavigationGraph(hotspots, waypoints, paths, sceneRoot, edges);

    // Ensure targetHotspot node has target camera position
    if (nodes.has(targetHotspot.id)) {
      nodes.get(targetHotspot.id)!.position.copy(pDest);
    } else {
      nodes.set(targetHotspot.id, {
        id: targetHotspot.id,
        name: targetHotspot.name,
        position: pDest.clone(),
        isHotspot: true,
      });
      adjacency.set(targetHotspot.id, []);
    }

    // Ensure targetHotspot has connections from nearby graph nodes if not already connected
    const destNeighbors = adjacency.get(targetHotspot.id) || [];
    if (destNeighbors.length === 0) {
      const destCandidates: { id: string; d: number }[] = [];
      nodes.forEach((node, id) => {
        if (id === targetHotspot.id) return;
        const d = pDest.distanceTo(node.position);
        const hDiff = Math.abs(pDest.y - node.position.y);
        if (d <= 12.0 && hDiff <= 2.5 && this.isLineSafe(pDest, node.position, sceneRoot, 0.15)) {
          destCandidates.push({ id, d });
        }
      });

      // Fallback without clearance if near surface
      if (destCandidates.length === 0) {
        nodes.forEach((node, id) => {
          if (id === targetHotspot.id) return;
          const d = pDest.distanceTo(node.position);
          const hDiff = Math.abs(pDest.y - node.position.y);
          if (d <= 12.0 && hDiff <= 2.5 && this.isLineSafe(pDest, node.position, sceneRoot, 0.0)) {
            destCandidates.push({ id, d });
          }
        });
      }

      destCandidates.sort((a, b) => a.d - b.d);
      if (destCandidates.length > 0) {
        // Connect to the closest node (or equivalent closest nodes within 25% margin)
        const minD = destCandidates[0].d;
        for (const cand of destCandidates) {
          if (cand.d > minD * 1.25 + 0.5) break;
          if (!adjacency.has(cand.id)) adjacency.set(cand.id, []);
          adjacency.get(cand.id)!.push({ fromNodeId: cand.id, toNodeId: targetHotspot.id, distance: cand.d });
          if (!adjacency.has(targetHotspot.id)) adjacency.set(targetHotspot.id, []);
          adjacency.get(targetHotspot.id)!.push({ fromNodeId: targetHotspot.id, toNodeId: cand.id, distance: cand.d });
        }
      }
    }

    // --- STEP 3: CONNECT CAMERA CURRENT POSITION TO GRAPH ---
    const candidateEntries: { nodeId: string; dist: number }[] = [];
    nodes.forEach((node, id) => {
      // Don't connect directly to dest if we already know direct line is blocked/long
      if (id === targetHotspot.id) return;

      const d = pStart.distanceTo(node.position);
      const hDiff = Math.abs(pStart.y - node.position.y);
      if (d <= 15.0 && hDiff <= 2.5 && this.isLineSafe(pStart, node.position, sceneRoot, 0.15)) {
        candidateEntries.push({ nodeId: id, dist: d });
      }
    });

    // Fallback: relax clearance if camera is elevated in orbit or close to boundary
    if (candidateEntries.length === 0) {
      nodes.forEach((node, id) => {
        if (id === targetHotspot.id) return;
        const d = pStart.distanceTo(node.position);
        const hDiff = Math.abs(pStart.y - node.position.y);
        if (d <= 15.0 && hDiff <= 3.2 && this.isLineSafe(pStart, node.position, sceneRoot, 0.0)) {
          candidateEntries.push({ nodeId: id, dist: d });
        }
      });
    }

    if (candidateEntries.length === 0) {
      // Camera is completely isolated by walls with no line-of-sight to any node
      return {
        success: false,
        reason: 'BLOCKED_BY_GEOMETRY',
        message:
          `Không tìm thấy đường bay an toàn từ vị trí hiện tại đến "${targetHotspot.name}". Khu vực hiện tại bị tường/vật cản che chắn và chưa có Waypoint dẫn đường. Vui lòng di chuyển camera ra khu vực thoáng hoặc thêm Waypoint.`,
      };
    }

    // Sort candidate entries by distance to camera (nearest graph entrance)
    candidateEntries.sort((a, b) => a.dist - b.dist);

    // If camera is already standing at/near a waypoint (< 0.8m), use it as immediate entry
    let searchEntries = candidateEntries;
    if (candidateEntries[0].dist < 0.8) {
      searchEntries = [candidateEntries[0]];
    } else {
      searchEntries = candidateEntries.slice(0, 3);
    }

    // --- STEP 4: A* GRAPH SEARCH ---
    let bestPathNodeIds: string[] | null = null;
    let minCost = Infinity;
    const OFF_GRAPH_WEIGHT = 2.5; // Favor traveling along graph edges over off-graph flight

    for (const entry of searchEntries) {
      const astarResult = this.runAStar(entry.nodeId, targetHotspot.id, nodes, adjacency, pDest);
      if (astarResult) {
        const cost = (entry.dist * OFF_GRAPH_WEIGHT) + astarResult.totalCost;
        if (cost < minCost) {
          minCost = cost;
          bestPathNodeIds = [entry.nodeId, ...astarResult.path];
        }
      }
    }

    if (!bestPathNodeIds) {
      return {
        success: false,
        reason: 'NO_ROUTE_FOUND',
        message:
          `Không tìm thấy tuyến đường nối từ vị trí camera đến "${destHotspot.name}". Vui lòng tạo thêm Camera Path hoặc Waypoint kết nối giữa các phòng.`,
      };
    }

    // --- STEP 5: ASSEMBLE UNIFIED TRAJECTORY ---
    const rawPoints: THREE.Vector3[] = [pStart];
    const waypointsOnRoute: string[] = [];

    for (const nid of bestPathNodeIds) {
      const node = nodes.get(nid);
      if (node) {
        // Prevent duplicate adjacent points
        const lastP = rawPoints[rawPoints.length - 1];
        if (lastP.distanceTo(node.position) > 0.05) {
          rawPoints.push(node.position.clone());
        }
        if (!node.isHotspot) {
          waypointsOnRoute.push(node.id);
        }
      }
    }

    // Guarantee end point is exact pDest
    if (rawPoints[rawPoints.length - 1].distanceTo(pDest) > 0.01) {
      rawPoints.push(pDest.clone());
    }

    // Smooth CatmullRom Spline trajectory
    const curve = new THREE.CatmullRomCurve3(rawPoints, false, 'centripetal', 0.5);
    const totalTrajectoryLength = curve.getLength();

    const endTangent = curve.getTangentAt(1.0).normalize();
    const endTangentQuat = this.smoothRotation.directionToQuaternion(endTangent);
    const angleDiff = this.smoothRotation.computeAngularDistance(endTangentQuat, qDest);
    const minRotTime = angleDiff / THREE.MathUtils.degToRad(180);

    // Duration based on comfortable flight speed (~2.8 m/s) and angular speed limit
    const baseDuration = totalTrajectoryLength / 2.8;
    const duration = Math.max(2.2, Math.min(12.0, Math.max(baseDuration, minRotTime / 0.65)));

    return {
      success: true,
      mode: 'graph',
      controlPoints: rawPoints,
      curve,
      targetPosition: pDest,
      targetQuaternion: qDest,
      durationSeconds: duration,
      waypointsOnRoute,
    };
  }

  /**
   * Internal A* search implementation on graph
   */
  private runAStar(
    startNodeId: string,
    targetNodeId: string,
    nodes: Map<string, GraphNode>,
    adjacency: Map<string, GraphEdge[]>,
    targetPos: THREE.Vector3
  ): { path: string[]; totalCost: number } | null {
    const openSet = new Set<string>([startNodeId]);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    nodes.forEach((_, id) => gScore.set(id, Infinity));
    gScore.set(startNodeId, 0);

    const fScore = new Map<string, number>();
    nodes.forEach((_, id) => fScore.set(id, Infinity));
    fScore.set(startNodeId, nodes.get(startNodeId)!.position.distanceTo(targetPos));

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let current: string | null = null;
      let lowestF = Infinity;
      for (const nid of openSet) {
        const f = fScore.get(nid) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nid;
        }
      }

      if (!current) break;

      if (current === targetNodeId) {
        // Reconstruct path
        const path: string[] = [];
        let curr: string | undefined = current;
        while (curr && curr !== startNodeId) {
          path.unshift(curr);
          curr = cameFrom.get(curr);
        }
        return { path, totalCost: gScore.get(targetNodeId) || 0 };
      }

      openSet.delete(current);

      const edges = adjacency.get(current) || [];
      const currentPos = nodes.get(current)!.position;

      for (const edge of edges) {
        const neighbor = edge.toNodeId;
        const neighborPos = nodes.get(neighbor)!.position;

        // Turn angle penalty for smoother camera motion
        let turnPenalty = 0;
        const prevId = cameFrom.get(current);
        if (prevId) {
          const prevPos = nodes.get(prevId)!.position;
          const vIn = new THREE.Vector3().subVectors(currentPos, prevPos).normalize();
          const vOut = new THREE.Vector3().subVectors(neighborPos, currentPos).normalize();
          const dot = vIn.dot(vOut); // 1 = straight, -1 = reverse
          if (dot < 0) {
            turnPenalty = (1 - dot) * 1.5; // Penalty for sharp turns
          }
        }

        const tentativeG = (gScore.get(current) || 0) + edge.distance + turnPenalty;

        if (tentativeG < (gScore.get(neighbor) || Infinity)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeG);
          fScore.set(neighbor, tentativeG + neighborPos.distanceTo(targetPos));
          openSet.add(neighbor);
        }
      }
    }

    return null;
  }
}
