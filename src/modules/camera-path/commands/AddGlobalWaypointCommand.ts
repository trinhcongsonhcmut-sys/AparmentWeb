import { ICommand } from '../../../shared/history/ICommand';
import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { CameraWaypoint } from '../types/cameraPath.types';
import { WaypointEdge } from '../types/waypointGraph.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class AddGlobalWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: WaypointGraphStore;
  private waypoint: CameraWaypoint;
  private createdEdges: WaypointEdge[];

  constructor(
    store: WaypointGraphStore,
    waypoint: CameraWaypoint,
    createdEdges: WaypointEdge[] = []
  ) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.waypoint = JSON.parse(JSON.stringify(waypoint));
    this.createdEdges = JSON.parse(JSON.stringify(createdEdges));
    this.label = `Thêm Waypoint toàn cục "${waypoint.name}"`;
  }

  execute(): void {
    this.store.addWaypoint(JSON.parse(JSON.stringify(this.waypoint)), true);
    for (const edge of this.createdEdges) {
      this.store.addEdge(JSON.parse(JSON.stringify(edge)), false);
    }
  }

  undo(): void {
    for (const edge of this.createdEdges) {
      this.store.deleteEdge(edge.id, false);
    }
    this.store.deleteWaypoint(this.waypoint.id, true);
  }
}

