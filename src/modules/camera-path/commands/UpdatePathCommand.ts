import { ICommand } from '../../../shared/history/ICommand';
import { CameraPathStore } from '../store/CameraPathStore';
import { CameraPath } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class UpdatePathCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: CameraPathStore;
  private prevPath: CameraPath;
  private nextPath: CameraPath;

  constructor(store: CameraPathStore, prevPath: CameraPath, nextPath: CameraPath, fieldLabel?: string) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.prevPath = JSON.parse(JSON.stringify(prevPath));
    this.nextPath = JSON.parse(JSON.stringify(nextPath));
    this.label = fieldLabel ? `Đổi ${fieldLabel} tuyến "${nextPath.name}"` : `Cập nhật tuyến "${nextPath.name}"`;
  }

  execute(): void {
    this.store.updatePath(JSON.parse(JSON.stringify(this.nextPath)), true);
  }

  undo(): void {
    this.store.updatePath(JSON.parse(JSON.stringify(this.prevPath)), true);
  }
}
