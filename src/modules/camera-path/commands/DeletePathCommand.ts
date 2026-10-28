import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { CameraPath, CameraWaypoint } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class DeletePathCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private path: CameraPath;
  private waypoints: CameraWaypoint[];

  constructor(store: CameraPathStore, path: CameraPath) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.path = JSON.parse(JSON.stringify(path));
    this.waypoints = store.getWaypointsForPath(path.id).map((w) => JSON.parse(JSON.stringify(w)));
    this.label = `Xóa tuyến camera "${path.name}"`;
  }

  execute(): void {
    this.store.deletePath(this.path.id, true);
  }

  undo(): void {
    this.store.restorePath(
      JSON.parse(JSON.stringify(this.path)),
      this.waypoints.map((w) => JSON.parse(JSON.stringify(w))),
      true
    );
  }
}
