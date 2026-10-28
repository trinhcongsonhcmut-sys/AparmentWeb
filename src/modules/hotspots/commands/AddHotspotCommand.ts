import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class AddHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private item: HotspotItem;

  constructor(store: HotspotStore, item: HotspotItem) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.item = item;
    this.label = `Thêm hotspot "${item.name}"`;
  }

  execute(): void {
    this.store.add(this.item, true);
    this.store.select(this.item.id);
  }

  undo(): void {
    this.store.remove(this.item.id, true);
  }
}
