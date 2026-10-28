import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { Vector3D } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class MoveHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private hotspotId: string;
  private prevPos: Vector3D;
  private newPos: Vector3D;
  private prevRot: Vector3D;
  private newRot: Vector3D;

  constructor(
    store: HotspotStore,
    hotspotId: string,
    prevPos: Vector3D,
    newPos: Vector3D,
    prevRot: Vector3D,
    newRot: Vector3D
  ) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.hotspotId = hotspotId;
    this.prevPos = { ...prevPos };
    this.newPos = { ...newPos };
    this.prevRot = { ...prevRot };
    this.newRot = { ...newRot };
    const item = store.getById(hotspotId);
    this.label = `Di chuyển "${item?.name || 'Hotspot'}"`;
  }

  execute(): void {
    const item = this.store.getById(this.hotspotId);
    if (item) {
      item.position = { ...this.newPos };
      item.rotation = { ...this.newRot };
      this.store.update(item, true);
    }
  }

  undo(): void {
    const item = this.store.getById(this.hotspotId);
    if (item) {
      item.position = { ...this.prevPos };
      item.rotation = { ...this.prevRot };
      this.store.update(item, true);
    }
  }
}
