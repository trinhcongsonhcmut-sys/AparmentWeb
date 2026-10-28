import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { CameraWaypoint } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class AddWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private waypoint: CameraWaypoint;
  private pathId: string;
  private insertIndex?: number;

  constructor(store: CameraPathStore, waypoint: CameraWaypoint, pathId: string, insertIndex?: number) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.waypoint = JSON.parse(JSON.stringify(waypoint));
    this.pathId = pathId;
    this.insertIndex = insertIndex;
    this.label = `Thêm waypoint "${waypoint.name}"`;
  }

  execute(): void {
    this.store.addWaypoint(
      JSON.parse(JSON.stringify(this.waypoint)),
      this.pathId,
      this.insertIndex,
      true
    );
  }

  undo(): void {
    this.store.removeWaypoint(this.waypoint.id, this.pathId, true);
  }
}
