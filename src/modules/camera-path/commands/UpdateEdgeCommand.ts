import type { ICommand } from '../../../shared/history/ICommand.ts';
import { WaypointGraphStore } from '../store/WaypointGraphStore.ts';
import type { WaypointEdge } from '../types/waypointGraph.types.ts';
import { MathUtils } from '../../../shared/math/MathUtils.ts';

export class UpdateEdgeCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: WaypointGraphStore;
  private oldEdge: WaypointEdge;
  private newEdge: WaypointEdge;

  constructor(store: WaypointGraphStore, oldEdge: WaypointEdge, newEdge: WaypointEdge) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.oldEdge = JSON.parse(JSON.stringify(oldEdge));
    this.newEdge = JSON.parse(JSON.stringify(newEdge));
    this.label = `Cập nhật trạng thái cạnh kết nối`;
  }

  execute(): void {
    this.store.updateEdge(JSON.parse(JSON.stringify(this.newEdge)), true);
  }

  undo(): void {
    this.store.updateEdge(JSON.parse(JSON.stringify(this.oldEdge)), true);
  }
}

