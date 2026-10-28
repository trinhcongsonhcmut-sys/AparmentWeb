import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { Vector3D } from '../../hotspots/types/hotspot.types';
import { WaypointOrientation } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class MoveWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private waypointId: string;
  private prevPos: Vector3D;
  private newPos: Vector3D;
  private prevOrientation: WaypointOrientation;
  private newOrientation: WaypointOrientation;

  constructor(
    store: CameraPathStore,
    waypointId: string,
    prevPos: Vector3D,
    newPos: Vector3D,
    prevOrientation: WaypointOrientation,
    newOrientation: WaypointOrientation
  ) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.waypointId = waypointId;
    this.prevPos = { ...prevPos };
    this.newPos = { ...newPos };
    this.prevOrientation = JSON.parse(JSON.stringify(prevOrientation));
    this.newOrientation = JSON.parse(JSON.stringify(newOrientation));
    const wp = store.getWaypoint(waypointId);
    this.label = `Di chuyển waypoint "${wp?.name || 'Waypoint'}"`;
  }

  execute(): void {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.newPos };
      wp.orientation = JSON.parse(JSON.stringify(this.newOrientation));
      this.store.updateWaypoint(wp, true);
    }
  }

  undo(): void {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.prevPos };
      wp.orientation = JSON.parse(JSON.stringify(this.prevOrientation));
      this.store.updateWaypoint(wp, true);
    }
  }
}
