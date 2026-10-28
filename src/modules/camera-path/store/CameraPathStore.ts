import {
  CameraPath,
  CameraWaypoint,
  CameraPathCurveType,
  CameraPathEasing,
} from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';
import { EventBus, EditorEvents } from '../../../shared/events/EventBus';

export type PathStoreChangeListener = () => void;

export class CameraPathStore {
  private paths: Map<string, CameraPath> = new Map();
  private waypoints: Map<string, CameraWaypoint> = new Map();
  private activePathId: string | null = null;
  private selectedWaypointId: string | null = null;
  private isDirty: boolean = false;

  private listeners: Set<PathStoreChangeListener> = new Set();
  private eventBus: EventBus = EventBus.getInstance();

  constructor() {
    //
  }

  // --- PATH METHODS ---
  public getAllPaths(): CameraPath[] {
    return Array.from(this.paths.values());
  }

  public getPath(id: string): CameraPath | undefined {
    return this.paths.get(id);
  }

  public getActivePath(): CameraPath | null {
    return this.activePathId ? this.paths.get(this.activePathId) || null : null;
  }

  public getActivePathId(): string | null {
    return this.activePathId;
  }

  public setActivePath(id: string | null): void {
    if (this.activePathId === id) return;
    this.activePathId = id;
    this.selectedWaypointId = null;
    this.notify();
    this.eventBus.emit('path:active_changed', this.getActivePath());
  }

  public createPath(
    name: string,
    fromHotspotId: string,
    toHotspotId: string,
    curveType: CameraPathCurveType = 'spline',
    durationSeconds: number = 8.0,
    easing: CameraPathEasing = 'easeInOut',
    markDirty: boolean = true
  ): CameraPath {
    const newPath: CameraPath = {
      id: MathUtils.generateUUID(),
      name: name.trim() || `Tuyến ${this.paths.size + 1}`,
      fromHotspotId,
      toHotspotId,
      waypointIds: [],
      curveType,
      tension: 0.5,
      durationSeconds,
      easing,
      bidirectional: false,
      enabled: true,
      warnings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addPath(newPath, markDirty);
    return newPath;
  }

  public addPath(path: CameraPath, markDirty: boolean = true): void {
    this.paths.set(path.id, path);
    this.activePathId = path.id;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('path:created', path);
  }

  public restorePath(
    path: CameraPath,
    waypoints: CameraWaypoint[] = [],
    markDirty: boolean = true
  ): void {
    this.paths.set(path.id, path);
    for (const wp of waypoints) {
      this.waypoints.set(wp.id, wp);
    }
    this.activePathId = path.id;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('path:created', path);
  }

  public updatePath(path: CameraPath, markDirty: boolean = true): void {
    const isNew = !this.paths.has(path.id);
    path.updatedAt = new Date().toISOString();
    this.paths.set(path.id, path);
    if (isNew || !this.activePathId) {
      this.activePathId = path.id;
    }
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit(isNew ? 'path:created' : 'path:updated', path);
  }

  public deletePath(id: string, markDirty: boolean = true): CameraPath | null {
    const existing = this.paths.get(id);
    if (existing) {
      for (const wpId of existing.waypointIds) {
        this.waypoints.delete(wpId);
      }
      this.paths.delete(id);
      if (this.activePathId === id) {
        this.activePathId = this.paths.size > 0 ? Array.from(this.paths.keys())[0] : null;
        this.selectedWaypointId = null;
      }
      if (markDirty) this.setDirty(true);
      this.notify();
      this.eventBus.emit('path:deleted', existing);
      return existing;
    }
    return null;
  }

  public duplicatePath(id: string): CameraPath | null {
    const original = this.paths.get(id);
    if (!original) return null;

    // Clone waypoints with new IDs
    const clonedWpIds: string[] = [];
    for (const wpId of original.waypointIds) {
      const origWp = this.waypoints.get(wpId);
      if (origWp) {
        const clonedWp: CameraWaypoint = {
          ...JSON.parse(JSON.stringify(origWp)),
          id: MathUtils.generateUUID(),
          name: `${origWp.name} (Bản sao)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.waypoints.set(clonedWp.id, clonedWp);
        clonedWpIds.push(clonedWp.id);
      }
    }

    const clonedPath: CameraPath = {
      ...JSON.parse(JSON.stringify(original)),
      id: MathUtils.generateUUID(),
      name: `${original.name} (Bản sao)`,
      waypointIds: clonedWpIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paths.set(clonedPath.id, clonedPath);
    this.activePathId = clonedPath.id;
    this.setDirty(true);
    this.notify();
    this.eventBus.emit('path:created', clonedPath);
    return clonedPath;
  }

  public reversePath(id: string): CameraPath | null {
    const original = this.paths.get(id);
    if (!original) return null;

    // Reverse waypoints sequence
    const reversedWpIds: string[] = [];
    for (let i = original.waypointIds.length - 1; i >= 0; i--) {
      const wpId = original.waypointIds[i];
      const origWp = this.waypoints.get(wpId);
      if (origWp) {
        const clonedWp: CameraWaypoint = {
          ...JSON.parse(JSON.stringify(origWp)),
          id: MathUtils.generateUUID(),
          name: `${origWp.name} (Khứ hồi)`,
          orientation: {
            ...origWp.orientation,
            // Invert yaw by 180 degrees if manual
            yaw: origWp.orientation.yaw !== undefined ? (origWp.orientation.yaw + 180) % 360 : undefined,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.waypoints.set(clonedWp.id, clonedWp);
        reversedWpIds.push(clonedWp.id);
      }
    }

    const reversedPath: CameraPath = {
      ...JSON.parse(JSON.stringify(original)),
      id: MathUtils.generateUUID(),
      name: `${original.name} (Chiều về)`,
      fromHotspotId: original.toHotspotId,
      toHotspotId: original.fromHotspotId,
      waypointIds: reversedWpIds,
      useCustomEndPosition: false,
      endPosition: undefined,
      startOrientation: original.endOrientation ? JSON.parse(JSON.stringify(original.endOrientation)) : undefined,
      endOrientation: original.startOrientation
        ? JSON.parse(JSON.stringify(original.startOrientation))
        : { mode: 'hotspot', useCustomPosition: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paths.set(reversedPath.id, reversedPath);
    this.activePathId = reversedPath.id;
    this.setDirty(true);
    this.notify();
    this.eventBus.emit('path:created', reversedPath);
    return reversedPath;
  }

  // --- WAYPOINT METHODS ---
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
    this.notify();
    if (id) {
      this.eventBus.emit('waypoint:selected', this.waypoints.get(id));
    } else {
      this.eventBus.emit('waypoint:deselected');
    }
  }

  public getWaypointsForPath(pathId: string): CameraWaypoint[] {
    const path = this.paths.get(pathId);
    if (!path) return [];
    return path.waypointIds
      .map((id) => this.waypoints.get(id))
      .filter((wp): wp is CameraWaypoint => !!wp);
  }

  public addWaypoint(
    wp: CameraWaypoint,
    pathId?: string,
    insertAtIndex?: number,
    markDirty: boolean = true
  ): void {
    this.waypoints.set(wp.id, wp);

    const targetPathId = pathId || this.activePathId;
    if (targetPathId) {
      const path = this.paths.get(targetPathId);
      if (path) {
        if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= path.waypointIds.length) {
          path.waypointIds.splice(insertAtIndex, 0, wp.id);
        } else {
          path.waypointIds.push(wp.id);
        }
        path.updatedAt = new Date().toISOString();
      }
    }

    this.selectedWaypointId = wp.id;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('waypoint:created', wp);
  }

  public updateWaypoint(wp: CameraWaypoint, markDirty: boolean = true): void {
    const isNew = !this.waypoints.has(wp.id);
    wp.updatedAt = new Date().toISOString();
    this.waypoints.set(wp.id, wp);
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit(isNew ? 'waypoint:created' : 'waypoint:updated', wp);
  }

  public removeWaypoint(
    id: string,
    pathId?: string,
    markDirty: boolean = true
  ): CameraWaypoint | null {
    const existing = this.waypoints.get(id);
    if (!existing) return null;

    const targetPathId = pathId || this.activePathId;
    if (targetPathId) {
      const path = this.paths.get(targetPathId);
      if (path) {
        path.waypointIds = path.waypointIds.filter((wpId) => wpId !== id);
        path.updatedAt = new Date().toISOString();
      }
    }

    this.waypoints.delete(id);
    if (this.selectedWaypointId === id) {
      this.selectedWaypointId = null;
    }

    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('waypoint:deleted', existing);
    return existing;
  }

  public reorderWaypoints(
    pathId: string,
    newWaypointIds: string[],
    markDirty: boolean = true
  ): void {
    const path = this.paths.get(pathId);
    if (path) {
      path.waypointIds = [...newWaypointIds];
      path.updatedAt = new Date().toISOString();
      if (markDirty) this.setDirty(true);
      this.notify();
      this.eventBus.emit('path:updated', path);
    }
  }

  // --- BULK STATE RESTORE ---
  public setAll(
    paths: CameraPath[],
    waypoints: CameraWaypoint[] = [],
    markDirty: boolean = false
  ): void {
    this.paths.clear();
    this.waypoints.clear();
    this.activePathId = null;
    this.selectedWaypointId = null;

    for (const p of paths) {
      this.paths.set(p.id, p);
    }
    for (const w of waypoints) {
      this.waypoints.set(w.id, w);
    }

    if (paths.length > 0) {
      this.activePathId = paths[0].id;
    }

    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('paths:batch_changed');
  }

  public clear(markDirty: boolean = true): void {
    this.paths.clear();
    this.waypoints.clear();
    this.activePathId = null;
    this.selectedWaypointId = null;
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit('paths:batch_changed');
  }

  public setDirty(dirty: boolean): void {
    if (this.isDirty !== dirty) {
      this.isDirty = dirty;
      this.eventBus.emit(EditorEvents.CONFIG_DIRTY_CHANGED, dirty);
    }
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public subscribe(listener: PathStoreChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
