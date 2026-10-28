import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class BulkHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private prevItems: HotspotItem[];
  private nextItems: HotspotItem[];

  constructor(
    store: HotspotStore,
    targetIds: string[],
    mutator: (item: HotspotItem) => void,
    actionLabel: string
  ) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.label = `${actionLabel} (${targetIds.length} mục)`;

    this.prevItems = [];
    this.nextItems = [];

    for (const id of targetIds) {
      const existing = store.getById(id);
      if (existing) {
        this.prevItems.push(JSON.parse(JSON.stringify(existing)));
        const cloned = JSON.parse(JSON.stringify(existing));
        mutator(cloned);
        this.nextItems.push(cloned);
      }
    }
  }

  execute(): void {
    for (const item of this.nextItems) {
      this.store.update(JSON.parse(JSON.stringify(item)), true);
    }
  }

  undo(): void {
    for (const item of this.prevItems) {
      this.store.update(JSON.parse(JSON.stringify(item)), true);
    }
  }
}
