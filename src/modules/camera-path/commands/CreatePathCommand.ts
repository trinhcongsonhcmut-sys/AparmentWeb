import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { CameraPath } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class CreatePathCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private path: CameraPath;

  constructor(store: CameraPathStore, path: CameraPath) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.path = JSON.parse(JSON.stringify(path));
    this.label = `Tạo tuyến camera "${path.name}"`;
  }

  execute(): void {
    this.store.addPath(JSON.parse(JSON.stringify(this.path)), true);
  }

  undo(): void {
    this.store.deletePath(this.path.id, true);
  }
}
