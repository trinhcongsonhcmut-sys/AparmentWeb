import { ICommand } from '../../../shared/history/ICommand';
import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { WaypointEdge } from '../types/waypointGraph.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class DeleteEdgeCommand implements ICommand {
  public readonly id: string;
  public readonly label: string;
  private store: WaypointGraphStore;
  private edge: WaypointEdge;

  constructor(store: WaypointGraphStore, edge: WaypointEdge) {
    this.id = MathUtils.generateUUID();
    this.store = store;
    this.edge = JSON.parse(JSON.stringify(edge));
    this.label = `Xóa cạnh kết nối`;
  }

  execute(): void {
    this.store.deleteEdge(this.edge.id, true);
  }

  undo(): void {
    this.store.addEdge(JSON.parse(JSON.stringify(this.edge)), true);
  }
}

