import * as THREE from 'three';
import type { CameraWaypoint } from '../types/cameraPath.types.ts';
import type {
  WaypointEdge,
  GraphDiagnosticsReport,
  DisconnectedComponent,
  EdgeObstacleIssue,
} from '../types/waypointGraph.types.ts';
import type { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types.ts';

export class GraphDiagnosticsService {
  private static instance: GraphDiagnosticsService | null = null;

  public static getInstance(): GraphDiagnosticsService {
    if (!GraphDiagnosticsService.instance) {
      GraphDiagnosticsService.instance = new GraphDiagnosticsService();
    }
    return GraphDiagnosticsService.instance;
  }

  /**
   * Identifies all waypoints with degree = 0 (no connected edges)
   */
  public findIsolatedWaypoints(
    waypoints: CameraWaypoint[],
    edges: WaypointEdge[]
  ): string[] {
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.fromWaypointId);
      connectedNodeIds.add(edge.toWaypointId);
    }

    const isolated: string[] = [];
    for (const wp of waypoints) {
      if (!connectedNodeIds.has(wp.id) && wp.status !== 'disabled') {
        isolated.push(wp.id);
      }
    }
    return isolated;
  }

  /**
   * Finds disconnected components (islands) in the graph using BFS
   */
  public findDisconnectedComponents(
    waypoints: CameraWaypoint[],
    edges: WaypointEdge[]
  ): DisconnectedComponent[] {
    const activeWaypoints = waypoints.filter((w) => w.status !== 'disabled');
    const wpMap = new Map(activeWaypoints.map((w) => [w.id, w]));

    // Build adjacency list (considering valid / non-blocked edges)
    const adj = new Map<string, Set<string>>();
    for (const wp of activeWaypoints) {
      adj.set(wp.id, new Set<string>());
    }

    for (const edge of edges) {
      if (edge.status === 'blocked') continue;
      if (adj.has(edge.fromWaypointId) && adj.has(edge.toWaypointId)) {
        adj.get(edge.fromWaypointId)!.add(edge.toWaypointId);
        if (edge.direction === 'bidirectional') {
          adj.get(edge.toWaypointId)!.add(edge.fromWaypointId);
        }
      }
    }

    const visited = new Set<string>();
    const components: DisconnectedComponent[] = [];
    let componentIdx = 1;

    for (const wp of activeWaypoints) {
      if (!visited.has(wp.id)) {
        const currentGroup: string[] = [];
        const queue: string[] = [wp.id];
        visited.add(wp.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          currentGroup.push(curr);

          const neighbors = adj.get(curr) || new Set();
          for (const n of neighbors) {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }

        components.push({
          componentIndex: componentIdx++,
          waypointIds: currentGroup,
        });
      }
    }

    return components;
  }

  /**
   * Checks for obstacle collisions along all edges
   */
  public auditEdgeObstacles(
    edges: WaypointEdge[],
    waypoints: CameraWaypoint[],
    isLineSafeFn?: (p1: THREE.Vector3, p2: THREE.Vector3) => boolean
  ): EdgeObstacleIssue[] {
    if (!isLineSafeFn) return [];

    const wpMap = new Map(waypoints.map((w) => [w.id, w]));
    const issues: EdgeObstacleIssue[] = [];

    for (const edge of edges) {
      const wpA = wpMap.get(edge.fromWaypointId);
      const wpB = wpMap.get(edge.toWaypointId);
      if (!wpA || !wpB) {
        issues.push({
          edgeId: edge.id,
          fromWaypointId: edge.fromWaypointId,
          toWaypointId: edge.toWaypointId,
          reason: 'Cạnh tham chiếu tới Waypoint không tồn tại trong hệ thống.',
        });
        continue;
      }

      const pA = new THREE.Vector3(wpA.position.x, wpA.position.y, wpA.position.z);
      const pB = new THREE.Vector3(wpB.position.x, wpB.position.y, wpB.position.z);

      const safe = isLineSafeFn(pA, pB);
      if (!safe && edge.status !== 'blocked' && !edge.confirmedByAdmin) {
        issues.push({
          edgeId: edge.id,
          fromWaypointId: edge.fromWaypointId,
          toWaypointId: edge.toWaypointId,
          reason: `Đường nối giữa "${wpA.name}" và "${wpB.name}" bị tường hoặc vật cản che chắn.`,
        });
      }
    }

    return issues;
  }

  /**
   * Checks if any waypoints are outside the model bounds
   */
  public checkOutOfBounds(
    waypoints: CameraWaypoint[],
    boundsCenter?: Vector3D,
    boundsSize?: Vector3D
  ): string[] {
    if (!boundsCenter || !boundsSize) return [];

    const halfX = (boundsSize.x / 2) * 1.25; // 25% tolerance
    const halfY = (boundsSize.y / 2) * 1.5;
    const halfZ = (boundsSize.z / 2) * 1.25;

    const minX = boundsCenter.x - halfX;
    const maxX = boundsCenter.x + halfX;
    const minY = boundsCenter.y - halfY;
    const maxY = boundsCenter.y + halfY;
    const minZ = boundsCenter.z - halfZ;
    const maxZ = boundsCenter.z + halfZ;

    const out: string[] = [];
    for (const wp of waypoints) {
      const p = wp.position;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY || p.z < minZ || p.z > maxZ) {
        out.push(wp.id);
      }
    }
    return out;
  }

  /**
   * Verifies if each hotspot has at least one reachable connection to the graph
   */
  public checkHotspotReachability(
    hotspots: HotspotItem[],
    waypoints: CameraWaypoint[],
    edges: WaypointEdge[],
    isLineSafeFn?: (p1: THREE.Vector3, p2: THREE.Vector3) => boolean
  ): string[] {
    const unreachable: string[] = [];
    const activeWaypoints = waypoints.filter((w) => w.status !== 'disabled');

    for (const h of hotspots) {
      if (h.type === 'info') continue; // Skip pure info hotspots

      const hPos = new THREE.Vector3(
        h.cameraView?.useCustomPosition && h.cameraView.cameraPosition
          ? h.cameraView.cameraPosition.x
          : h.position.x,
        h.cameraView?.useCustomPosition && h.cameraView.cameraPosition
          ? h.cameraView.cameraPosition.y
          : h.position.y < 1.0 ? 1.6 : h.position.y,
        h.cameraView?.useCustomPosition && h.cameraView.cameraPosition
          ? h.cameraView.cameraPosition.z
          : h.position.z
      );

      let canConnect = false;
      for (const wp of activeWaypoints) {
        const wpPos = new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z);
        const dist = hPos.distanceTo(wpPos);
        const hDiff = Math.abs(hPos.y - wpPos.y);

        if (dist <= 10.0 && hDiff <= 1.8) {
          if (!isLineSafeFn || isLineSafeFn(hPos, wpPos)) {
            canConnect = true;
            break;
          }
        }
      }

      if (!canConnect) {
        unreachable.push(h.id);
      }
    }

    return unreachable;
  }

  /**
   * Runs the complete diagnostics suite
   */
  public runDiagnostics(
    waypoints: CameraWaypoint[],
    edges: WaypointEdge[],
    hotspots: HotspotItem[] = [],
    boundsCenter?: Vector3D,
    boundsSize?: Vector3D,
    isLineSafeFn?: (p1: THREE.Vector3, p2: THREE.Vector3) => boolean
  ): GraphDiagnosticsReport {
    const isolated = this.findIsolatedWaypoints(waypoints, edges);
    const components = this.findDisconnectedComponents(waypoints, edges);
    const obstacleIssues = this.auditEdgeObstacles(edges, waypoints, isLineSafeFn);
    const outOfBounds = this.checkOutOfBounds(waypoints, boundsCenter, boundsSize);
    const unreachableHotspots = this.checkHotspotReachability(
      hotspots,
      waypoints,
      edges,
      isLineSafeFn
    );

    const validEdges = edges.filter((e) => e.status === 'valid').length;
    const blockedEdges = edges.filter((e) => e.status === 'blocked').length;
    const needsConfEdges = edges.filter((e) => e.status === 'needs_confirmation').length;

    const isHealthy =
      isolated.length === 0 &&
      components.length <= 1 &&
      obstacleIssues.length === 0 &&
      outOfBounds.length === 0 &&
      unreachableHotspots.length === 0;

    return {
      timestamp: new Date().toISOString(),
      totalWaypoints: waypoints.length,
      activeWaypoints: waypoints.filter((w) => w.status !== 'disabled').length,
      totalEdges: edges.length,
      validEdges,
      blockedEdges,
      needsConfirmationEdges: needsConfEdges,
      isolatedWaypointIds: isolated,
      components,
      obstacleIssues,
      outOfBoundsWaypointIds: outOfBounds,
      unreachableHotspotIds: unreachableHotspots,
      isHealthy,
    };
  }
}

