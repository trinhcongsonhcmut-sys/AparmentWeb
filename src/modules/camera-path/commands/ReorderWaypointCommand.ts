import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { MathUtils } from '../../../shared/math/MathUtils';

export class ReorderWaypointCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private pathId: string;
  private prevSequence: string[];
  private nextSequence: string[];

  constructor(store: CameraPathStore, pathId: string, prevSequence: string[], nextSequence: string[]) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.pathId = pathId;
    this.prevSequence = [...prevSequence];
    this.nextSequence = [...nextSequence];
    this.label = 'Đổi thứ tự waypoint';
  }

  execute(): void {
    this.store.reorderWaypoints(this.pathId, this.nextSequence, true);
  }

  undo(): void {
    this.store.reorderWaypoints(this.pathId, this.prevSequence, true);
  }
}
