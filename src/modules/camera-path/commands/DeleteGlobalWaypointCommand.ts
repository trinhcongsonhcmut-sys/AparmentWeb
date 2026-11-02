import type { ICommand } from '../../../shared/history/ICommand.ts';
import { WaypointGraphStore } from '../store/WaypointGraphStore.ts';
import { CameraPathStore } from '../store/CameraPathStore.ts';
import type { CameraWaypoint } from '../types/cameraPath.types.ts';
import type { WaypointEdge } from '../types/waypointGraph.types.ts';
import { MathUtils } from '../../../shared/math/MathUtils.ts';

export class DeleteGlobalWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private graphStore: WaypointGraphStore;
  private pathStore?: CameraPathStore;
  private waypoint: CameraWaypoint;
  private backedUpEdges: WaypointEdge[];
  private affectedPathIndices: { pathId: string; index: number }[] = [];

  constructor(
    graphStore: WaypointGraphStore,
    waypoint: CameraWaypoint,
    pathStore?: CameraPathStore
  ) {
    this.id = MathUtils.generateUUID();
    this.graphStore = graphStore;
    this.pathStore = pathStore;
    this.waypoint = JSON.parse(JSON.stringify(waypoint));
    this.backedUpEdges = JSON.parse(JSON.stringify(graphStore.getEdgesForWaypoint(waypoint.id)));
    this.label = `Xóa Waypoint "${waypoint.name}"`;

    if (pathStore) {
      const paths = pathStore.getPathsUsingWaypoint(waypoint.id);
      for (const p of paths) {
        const idx = p.waypointIds.indexOf(waypoint.id);
        if (idx !== -1) {
          this.affectedPathIndices.push({ pathId: p.id, index: idx });
        }
      }
    }
  }

  execute(): void {
    if (this.pathStore) {
      this.pathStore.removeWaypointFromAllPaths(this.waypoint.id, false);
    }
    this.graphStore.deleteWaypoint(this.waypoint.id, true);
  }

  undo(): void {
    this.graphStore.addWaypoint(JSON.parse(JSON.stringify(this.waypoint)), false);
    for (const edge of this.backedUpEdges) {
      this.graphStore.addEdge(JSON.parse(JSON.stringify(edge)), false);
    }
    if (this.pathStore) {
      for (const item of this.affectedPathIndices) {
        const path = this.pathStore.getPath(item.pathId);
        if (path) {
          path.waypointIds.splice(item.index, 0, this.waypoint.id);
          this.pathStore.updatePath(path, false);
        }
      }
    }
    this.graphStore.setDirty(true);
  }
}

