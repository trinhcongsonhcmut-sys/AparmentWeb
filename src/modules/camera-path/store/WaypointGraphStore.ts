import * as THREE from 'three';
import type { CameraWaypoint } from '../types/cameraPath.types.ts';
import type {
  WaypointEdge,
  AutoConnectOptions,
  AutoConnectResult,
  EdgeDirection,
  EdgeStatus,
} from '../types/waypointGraph.types.ts';
import { MathUtils } from '../../../shared/math/MathUtils.ts';
import { EventBus } from '../../../shared/events/EventBus.ts';

export type GraphStoreChangeListener = () => void;

export class WaypointGraphStore {
  private static instance: WaypointGraphStore | null = null;

  private waypoints: Map<string, CameraWaypoint> = new Map();
  private edges: Map<string, WaypointEdge> = new Map();

  private selectedWaypointId: string | null = null;
  private selectedEdgeId: string | null = null;
  private isDirty: boolean = false;

  private listeners: Set<GraphStoreChangeListener> = new Set();
  private eventBus: EventBus = EventBus.getInstance();

  public static getInstance(): WaypointGraphStore {
    if (!WaypointGraphStore.instance) {
      WaypointGraphStore.instance = new WaypointGraphStore();
    }
    return WaypointGraphStore.instance;
  }

  public constructor() {
    //
  }

  public subscribe(listener: GraphStoreChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
    this.eventBus.emit('graph:changed', {
      waypointsCount: this.waypoints.size,
      edgesCount: this.edges.size,
    });
  }

  public setDirty(dirty: boolean): void {
    this.isDirty = dirty;
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  // ==========================================
  // WAYPOINT OPERATIONS
  // ==========================================

  public getAllWaypoints(): CameraWaypoint[] {
    return Array.from(this.waypoints.values());
  }

  public getWaypoint(id: string): CameraWaypoint | undefined {
    return this.waypoints.get(id);
  }

  public getSelectedWaypoint(): CameraWaypoint | null {
    return this.selectedWaypointId ? this.waypoints.get(this.selectedWaypointId) || null : null;
  }

  public getSelectedWaypointId(): string | null {
    return this.selectedWaypointId;
  }

  public selectWaypoint(id: string | null): void {
    if (this.selectedWaypointId === id) return;
    this.selectedWaypointId = id;
    if (id) {
      this.selectedEdgeId = null; // Deselect edge when selecting waypoint
    }
    this.notify();
    if (id) {
      this.eventBus.emit('graph:waypoint_selected', this.waypoints.get(id));
    } else {
      this.eventBus.emit('graph:waypoint_deselected');
    }
  }

  public createWaypoint(
    name: string,
    position: { x: number; y: number; z: number },
    options: {
      zone?: string;
      floor?: number;
      orientationMode?: 'followPath' | 'manual' | 'lookAt';
      yaw?: number;
      pitch?: number;
    } = {},
    markDirty: boolean = true
  ): CameraWaypoint {
    const wp: CameraWaypoint = {
      id: MathUtils.generateUUID(),
      name: name.trim() || `Waypoint W${this.waypoints.size + 1}`,
      position: {
        x: MathUtils.round(position.x, 2),
        y: MathUtils.round(position.y, 2),
        z: MathUtils.round(position.z, 2),
      },
      zone: options.zone || '',
      floor: options.floor !== undefined ? options.floor : 1,
      status: 'active',
      orientation: {
        mode: options.orientationMode || 'followPath',
        yaw: options.yaw !== undefined ? options.yaw : 0,
        pitch: options.pitch !== undefined ? options.pitch : 0,
        roll: 0,
      },
      locked: false,
      dwellTimeSeconds: 0,
      speedMultiplier: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addWaypoint(wp, markDirty);
    return wp;
  }

  public addWaypoint(wp: CameraWaypoint, markDirty: boolean = true): void {
    this.waypoints.set(wp.id, wp);
    this.selectedWaypointId = wp.id;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:waypoint_added', wp);
  }

  public updateWaypoint(wp: CameraWaypoint, markDirty: boolean = true): void {
    const existing = this.waypoints.get(wp.id);
    if (!existing) return;

    wp.updatedAt = new Date().toISOString();
    this.waypoints.set(wp.id, wp);

    // Always recalculate lengths of all connected edges
    this.recalculateConnectedEdgeDistances(wp.id);

    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:waypoint_updated', wp);
  }

  public deleteWaypoint(
    id: string,
    markDirty: boolean = true
  ): { waypoint: CameraWaypoint; deletedEdges: WaypointEdge[] } | null {
    const existing = this.waypoints.get(id);
    if (!existing) return null;

    // Find and delete all connected edges
    const connectedEdges = this.getEdgesForWaypoint(id);
    for (const edge of connectedEdges) {
      this.edges.delete(edge.id);
    }

    this.waypoints.delete(id);

    if (this.selectedWaypointId === id) {
      this.selectedWaypointId = null;
    }

    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:waypoint_deleted', {
      waypoint: existing,
      deletedEdges: connectedEdges,
    });

    return { waypoint: existing, deletedEdges: connectedEdges };
  }

  public duplicateWaypoint(id: string): CameraWaypoint | null {
    const orig = this.waypoints.get(id);
    if (!orig) return null;

    const copy: CameraWaypoint = {
      ...JSON.parse(JSON.stringify(orig)),
      id: MathUtils.generateUUID(),
      name: `${orig.name} (Bản sao)`,
      position: {
        x: MathUtils.round(orig.position.x + 0.5, 2),
        y: orig.position.y,
        z: MathUtils.round(orig.position.z + 0.5, 2),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addWaypoint(copy, true);
    return copy;
  }

  public toggleLock(id: string): void {
    const wp = this.waypoints.get(id);
    if (wp) {
      wp.locked = !wp.locked;
      this.updateWaypoint(wp, true);
    }
  }

  // ==========================================
  // EDGE OPERATIONS
  // ==========================================

  public getAllEdges(): WaypointEdge[] {
    return Array.from(this.edges.values());
  }

  public getValidEdges(): WaypointEdge[] {
    return Array.from(this.edges.values()).filter(
      (e) => e.status === 'valid' || e.confirmedByAdmin === true
    );
  }

  public getEdge(id: string): WaypointEdge | undefined {
    return this.edges.get(id);
  }

  public getSelectedEdge(): WaypointEdge | null {
    return this.selectedEdgeId ? this.edges.get(this.selectedEdgeId) || null : null;
  }

  public getSelectedEdgeId(): string | null {
    return this.selectedEdgeId;
  }

  public selectEdge(id: string | null): void {
    if (this.selectedEdgeId === id) return;
    this.selectedEdgeId = id;
    if (id) {
      this.selectedWaypointId = null; // Deselect waypoint when selecting edge
    }
    this.notify();
    if (id) {
      this.eventBus.emit('graph:edge_selected', this.edges.get(id));
    } else {
      this.eventBus.emit('graph:edge_deselected');
    }
  }

  public getEdgesForWaypoint(waypointId: string): WaypointEdge[] {
    const result: WaypointEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromWaypointId === waypointId || edge.toWaypointId === waypointId) {
        result.push(edge);
      }
    }
    return result;
  }

  public getEdgeBetween(wpIdA: string, wpIdB: string): WaypointEdge | undefined {
    for (const edge of this.edges.values()) {
      if (
        (edge.fromWaypointId === wpIdA && edge.toWaypointId === wpIdB) ||
        (edge.direction === 'bidirectional' &&
          edge.fromWaypointId === wpIdB &&
          edge.toWaypointId === wpIdA)
      ) {
        return edge;
      }
    }
    return undefined;
  }

  public createEdge(
    fromWaypointId: string,
    toWaypointId: string,
    options: {
      direction?: EdgeDirection;
      status?: EdgeStatus;
      costWeight?: number;
      autoGenerated?: boolean;
      confirmedByAdmin?: boolean;
      notes?: string;
    } = {},
    markDirty: boolean = true
  ): WaypointEdge | null {
    if (fromWaypointId === toWaypointId) return null;

    const wpA = this.waypoints.get(fromWaypointId);
    const wpB = this.waypoints.get(toWaypointId);
    if (!wpA || !wpB) return null;

    // Check if edge already exists
    const existing = this.getEdgeBetween(fromWaypointId, toWaypointId);
    if (existing) {
      return existing;
    }

    const posA = new THREE.Vector3(wpA.position.x, wpA.position.y, wpA.position.z);
    const posB = new THREE.Vector3(wpB.position.x, wpB.position.y, wpB.position.z);
    const distance = MathUtils.round(posA.distanceTo(posB), 2);
    const duration = MathUtils.round(Math.max(1.0, distance / 2.5), 1); // ~2.5 m/s

    const edge: WaypointEdge = {
      id: MathUtils.generateUUID(),
      fromWaypointId,
      toWaypointId,
      direction: options.direction || 'bidirectional',
      status: options.status || 'valid',
      distance,
      estimatedDurationSeconds: duration,
      costWeight: options.costWeight !== undefined ? options.costWeight : 1.0,
      autoGenerated: options.autoGenerated || false,
      confirmedByAdmin: options.confirmedByAdmin || false,
      notes: options.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addEdge(edge, markDirty);
    return edge;
  }

  public addEdge(edge: WaypointEdge, markDirty: boolean = true): void {
    this.edges.set(edge.id, edge);
    this.selectedEdgeId = edge.id;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:edge_added', edge);
  }

  public updateEdge(edge: WaypointEdge, markDirty: boolean = true): void {
    edge.updatedAt = new Date().toISOString();
    this.edges.set(edge.id, edge);
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:edge_updated', edge);
  }

  public deleteEdge(id: string, markDirty: boolean = true): WaypointEdge | null {
    const existing = this.edges.get(id);
    if (!existing) return null;

    this.edges.delete(id);
    if (this.selectedEdgeId === id) {
      this.selectedEdgeId = null;
    }
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('graph:edge_deleted', existing);
    return existing;
  }

  public recalculateConnectedEdgeDistances(waypointId: string): void {
    const connectedEdges = this.getEdgesForWaypoint(waypointId);
    for (const edge of connectedEdges) {
      const wpA = this.waypoints.get(edge.fromWaypointId);
      const wpB = this.waypoints.get(edge.toWaypointId);
      if (wpA && wpB) {
        const pA = new THREE.Vector3(wpA.position.x, wpA.position.y, wpA.position.z);
        const pB = new THREE.Vector3(wpB.position.x, wpB.position.y, wpB.position.z);
        edge.distance = MathUtils.round(pA.distanceTo(pB), 2);
        edge.estimatedDurationSeconds = MathUtils.round(Math.max(1.0, edge.distance / 2.5), 1);
        edge.updatedAt = new Date().toISOString();
      }
    }
  }

  public getNeighbors(
    waypointId: string
  ): { waypoint: CameraWaypoint; edge: WaypointEdge; isOutgoing: boolean }[] {
    const neighbors: { waypoint: CameraWaypoint; edge: WaypointEdge; isOutgoing: boolean }[] = [];
    const connected = this.getEdgesForWaypoint(waypointId);

    for (const edge of connected) {
      if (edge.fromWaypointId === waypointId) {
        const target = this.waypoints.get(edge.toWaypointId);
        if (target) {
          neighbors.push({ waypoint: target, edge, isOutgoing: true });
        }
      } else if (edge.direction === 'bidirectional') {
        const source = this.waypoints.get(edge.fromWaypointId);
        if (source) {
          neighbors.push({ waypoint: source, edge, isOutgoing: false });
        }
      }
    }
    return neighbors;
  }

  // ==========================================
  // AUTO-CONNECT PROPOSER
  // ==========================================

  public proposeConnections(
    options: AutoConnectOptions = {},
    isLineSafeFn?: (p1: THREE.Vector3, p2: THREE.Vector3) => boolean
  ): AutoConnectResult {
    const maxDist = options.maxDistance || 8.0;
    const maxHeightDiff = options.maxHeightDiff || 1.5;
    const wpList = this.getAllWaypoints().filter((w) => w.status !== 'disabled');

    const result: AutoConnectResult = {
      proposedCount: 0,
      validCount: 0,
      blockedCount: 0,
      needsConfirmationCount: 0,
      edges: [],
    };

    for (let i = 0; i < wpList.length; i++) {
      for (let j = i + 1; j < wpList.length; j++) {
        const wA = wpList[i];
        const wB = wpList[j];

        // Check if edge already exists
        const existing = this.getEdgeBetween(wA.id, wB.id);
        if (existing && !options.overwriteExisting) {
          continue;
        }

        const pA = new THREE.Vector3(wA.position.x, wA.position.y, wA.position.z);
        const pB = new THREE.Vector3(wB.position.x, wB.position.y, wB.position.z);

        const dist = pA.distanceTo(pB);
        if (dist > maxDist) continue;

        const hDiff = Math.abs(pA.y - pB.y);
        let status: EdgeStatus = 'valid';

        if (existing && existing.confirmedByAdmin) {
          // If the admin manually confirmed this edge safe, preserve their confirmation!
          status = 'valid';
        } else {
          // Height differential check (different floor / stairs)
          if (hDiff > maxHeightDiff) {
            status = 'needs_confirmation';
          }

          // Raycast geometry collision check
          if (isLineSafeFn) {
            const safe = isLineSafeFn(pA, pB);
            if (!safe) {
              status = 'blocked';
            }
          }
        }

        const edge: WaypointEdge = {
          id: existing ? existing.id : MathUtils.generateUUID(),
          fromWaypointId: wA.id,
          toWaypointId: wB.id,
          direction: options.bidirectional !== false ? 'bidirectional' : 'unidirectional',
          status,
          distance: MathUtils.round(dist, 2),
          estimatedDurationSeconds: MathUtils.round(Math.max(1.0, dist / 2.5), 1),
          costWeight: existing && existing.costWeight !== undefined ? existing.costWeight : 1.0,
          autoGenerated: true,
          confirmedByAdmin: existing ? !!existing.confirmedByAdmin : false,
          createdAt: existing ? existing.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.edges.set(edge.id, edge);
        result.proposedCount++;
        result.edges.push(edge);

        if (status === 'valid') result.validCount++;
        else if (status === 'blocked') result.blockedCount++;
        else if (status === 'needs_confirmation') result.needsConfirmationCount++;
      }
    }

    if (result.proposedCount > 0) {
      this.setDirty(true);
      this.notify();
    }

    return result;
  }

  // ==========================================
  // SERIALIZATION & REHYDRATION
  // ==========================================

  public clear(): void {
    this.waypoints.clear();
    this.edges.clear();
    this.selectedWaypointId = null;
    this.selectedEdgeId = null;
    this.isDirty = false;
    this.notify();
  }

  public loadData(waypoints: CameraWaypoint[], edges: WaypointEdge[] = []): void {
    this.waypoints.clear();
    this.edges.clear();

    for (const wp of waypoints) {
      this.waypoints.set(wp.id, {
        ...wp,
        status: wp.status || 'active',
        zone: wp.zone || '',
        floor: wp.floor !== undefined ? wp.floor : 1,
      });
    }

    for (const edge of edges) {
      this.edges.set(edge.id, {
        ...edge,
        direction: edge.direction || 'bidirectional',
        status: edge.status || 'valid',
        costWeight: edge.costWeight !== undefined ? edge.costWeight : 1.0,
      });
    }

    this.selectedWaypointId = null;
    this.selectedEdgeId = null;
    this.isDirty = false;
    this.notify();
  }
}

