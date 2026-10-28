import { ICommand } from '../../../shared/history/ICommand';
import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class DuplicateHotspotCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: HotspotStore;
  private duplicatedItem: HotspotItem;

  constructor(store: HotspotStore, sourceItem: HotspotItem) {
    this.id = MathUtils.generateUUID();
    this.store = store;

    // Create duplicate with offset position and new UUID
    this.duplicatedItem = {
      ...JSON.parse(JSON.stringify(sourceItem)),
      id: MathUtils.generateUUID(),
      name: `${sourceItem.name} (Bản sao)`,
      position: {
        x: MathUtils.round(sourceItem.position.x + 0.3, 2),
        y: MathUtils.round(sourceItem.position.y, 2),
        z: MathUtils.round(sourceItem.position.z + 0.3, 2),
      },
      source: {
        kind: 'duplicated',
        originalName: sourceItem.name,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.label = `Nhân bản "${sourceItem.name}"`;
  }

  execute(): void {
    this.store.add(this.duplicatedItem, true);
    this.store.select(this.duplicatedItem.id);
  }

  undo(): void {
    this.store.remove(this.duplicatedItem.id, true);
  }
}
