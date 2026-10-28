import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class DeleteHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private deletedItems: HotspotItem[];

  constructor(store: HotspotStore, items: HotspotItem | HotspotItem[]) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.deletedItems = Array.isArray(items) ? [...items] : [items];
    this.label =
      this.deletedItems.length === 1
        ? `Xóa hotspot "${this.deletedItems[0].name}"`
        : `Xóa ${this.deletedItems.length} hotspot`;
  }

  execute(): void {
    for (const item of this.deletedItems) {
      this.store.remove(item.id, true);
    }
  }

  undo(): void {
    for (const item of this.deletedItems) {
      this.store.add(item, true);
    }
    if (this.deletedItems.length === 1) {
      this.store.select(this.deletedItems[0].id);
    }
  }
}
