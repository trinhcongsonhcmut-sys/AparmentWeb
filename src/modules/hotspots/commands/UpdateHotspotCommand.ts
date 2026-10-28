import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class UpdateHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private prevItem: HotspotItem;
  private nextItem: HotspotItem;

  constructor(store: HotspotStore, prevItem: HotspotItem, nextItem: HotspotItem, fieldLabel?: string) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.prevItem = JSON.parse(JSON.stringify(prevItem));
    this.nextItem = JSON.parse(JSON.stringify(nextItem));
    this.label = fieldLabel ? `Đổi ${fieldLabel} "${nextItem.name}"` : `Cập nhật "${nextItem.name}"`;
  }

  execute(): void {
    this.store.update(JSON.parse(JSON.stringify(this.nextItem)), true);
  }

  undo(): void {
    this.store.update(JSON.parse(JSON.stringify(this.prevItem)), true);
  }
}
