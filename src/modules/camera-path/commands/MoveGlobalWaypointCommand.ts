import { ICommand } from '../../../shared/history/ICommand';
import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { Vector3D } from '../../hotspots/types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class MoveGlobalWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: WaypointGraphStore;
  private waypointId: string;
  private oldPosition: Vector3D;
  private newPosition: Vector3D;

  constructor(
    store: WaypointGraphStore,
    waypointId: string,
    oldPos: Vector3D,
    newPos: Vector3D
  ) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.waypointId = waypointId;
    this.oldPosition = { ...oldPos };
    this.newPosition = { ...newPos };
    this.label = `Di chuyển Waypoint`;
  }

  execute(): void {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.newPosition };
      this.store.updateWaypoint(wp, true);
    }
  }

  undo(): void {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.oldPosition };
      this.store.updateWaypoint(wp, true);
    }
  }
}

