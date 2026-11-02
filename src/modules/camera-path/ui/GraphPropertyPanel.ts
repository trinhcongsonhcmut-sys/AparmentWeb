import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { CameraPathStore } from '../store/CameraPathStore';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { CameraWaypoint } from '../types/cameraPath.types';
import { WaypointEdge, EdgeDirection, EdgeStatus, WaypointStatus } from '../types/waypointGraph.types';
import { DeleteGlobalWaypointCommand } from '../commands/DeleteGlobalWaypointCommand';
import { DeleteEdgeCommand } from '../commands/DeleteEdgeCommand';
import { UpdateEdgeCommand } from '../commands/UpdateEdgeCommand';
import { AddEdgeCommand } from '../commands/AddEdgeCommand';

export class GraphPropertyPanel {
  private store: WaypointGraphStore;
  private pathStore: CameraPathStore;
  private history: CommandHistory;

  private emptyState: HTMLElement;
  private wpForm: HTMLElement;
  private edgeForm: HTMLElement;

  // Waypoint Form Elements
  private inputWpName: HTMLInputElement;
  private inputWpId: HTMLInputElement;
  private inputWpZone: HTMLInputElement;
  private inputWpFloor: HTMLInputElement;
  private selectWpStatus: HTMLSelectElement;
  private chkWpLocked: HTMLInputElement;
  private inputWpPosX: HTMLInputElement;
  private inputWpPosY: HTMLInputElement;
  private inputWpPosZ: HTMLInputElement;
  private neighborsContainer: HTMLElement;
  private selectConnectTarget: HTMLSelectElement;
  private btnCreateEdgeManual: HTMLButtonElement;
  private btnWpDuplicate: HTMLButtonElement;
  private btnWpDelete: HTMLButtonElement;

  // Edge Form Elements
  private txtEdgeFrom: HTMLElement;
  private txtEdgeTo: HTMLElement;
  private selectEdgeDirection: HTMLSelectElement;
  private selectEdgeStatus: HTMLSelectElement;
  private txtEdgeDistance: HTMLElement;
  private txtEdgeDuration: HTMLElement;
  private inputEdgeCostWeight: HTMLInputElement;
  private btnRetestCollision: HTMLButtonElement;
  private btnConfirmSafe: HTMLButtonElement;
  private btnDeleteEdge: HTMLButtonElement;
  private badgeAdminConfirmed?: HTMLElement;

  private isInternalUpdate: boolean = false;
  private onRetestEdge?: (edge: WaypointEdge) => void;
  private onEdgeAdminConfirmed?: (edge: WaypointEdge) => void;

  constructor(
    store: WaypointGraphStore,
    pathStore: CameraPathStore,
    history: CommandHistory,
    callbacks: {
      onRetestEdge?: (edge: WaypointEdge) => void;
      onEdgeAdminConfirmed?: (edge: WaypointEdge) => void;
    } = {}
  ) {
    this.store = store;
    this.pathStore = pathStore;
    this.history = history;
    this.onRetestEdge = callbacks.onRetestEdge;
    this.onEdgeAdminConfirmed = callbacks.onEdgeAdminConfirmed;

    this.emptyState = document.getElementById('graph-inspector-empty')!;
    this.wpForm = document.getElementById('graph-wp-inspector-form')!;
    this.edgeForm = document.getElementById('graph-edge-inspector-form')!;

    // Waypoint fields
    this.inputWpName = document.getElementById('prop-graph-wp-name') as HTMLInputElement;
    this.inputWpId = document.getElementById('prop-graph-wp-id') as HTMLInputElement;
    this.inputWpZone = document.getElementById('prop-graph-wp-zone') as HTMLInputElement;
    this.inputWpFloor = document.getElementById('prop-graph-wp-floor') as HTMLInputElement;
    this.selectWpStatus = document.getElementById('prop-graph-wp-status') as HTMLSelectElement;
    this.chkWpLocked = document.getElementById('prop-graph-wp-locked') as HTMLInputElement;
    this.inputWpPosX = document.getElementById('prop-graph-wp-pos-x') as HTMLInputElement;
    this.inputWpPosY = document.getElementById('prop-graph-wp-pos-y') as HTMLInputElement;
    this.inputWpPosZ = document.getElementById('prop-graph-wp-pos-z') as HTMLInputElement;
    this.neighborsContainer = document.getElementById('graph-wp-neighbors-list')!;
    this.selectConnectTarget = document.getElementById('prop-graph-connect-target') as HTMLSelectElement;
    this.btnCreateEdgeManual = document.getElementById('btn-create-edge-manual') as HTMLButtonElement;
    this.btnWpDuplicate = document.getElementById('btn-graph-wp-duplicate') as HTMLButtonElement;
    this.btnWpDelete = document.getElementById('btn-graph-wp-delete') as HTMLButtonElement;

    // Edge fields
    this.txtEdgeFrom = document.getElementById('prop-edge-from-name')!;
    this.txtEdgeTo = document.getElementById('prop-edge-to-name')!;
    this.selectEdgeDirection = document.getElementById('prop-edge-direction') as HTMLSelectElement;
    this.selectEdgeStatus = document.getElementById('prop-edge-status') as HTMLSelectElement;
    this.txtEdgeDistance = document.getElementById('prop-edge-distance')!;
    this.txtEdgeDuration = document.getElementById('prop-edge-duration')!;
    this.inputEdgeCostWeight = document.getElementById('prop-edge-cost-weight') as HTMLInputElement;
    this.btnRetestCollision = document.getElementById('btn-retest-edge-collision') as HTMLButtonElement;
    this.btnConfirmSafe = document.getElementById('btn-confirm-edge-safe') as HTMLButtonElement;
    this.btnDeleteEdge = document.getElementById('btn-delete-edge') as HTMLButtonElement;
    this.badgeAdminConfirmed = document.getElementById('prop-edge-admin-badge') || undefined;

    this.bindEvents();
    this.store.subscribe(() => this.updateFromStore());
  }

  private bindEvents(): void {
    // Waypoint inputs
    const handleWpChange = () => {
      if (this.isInternalUpdate) return;
      const wp = this.store.getSelectedWaypoint();
      if (!wp) return;

      wp.name = this.inputWpName.value.trim() || wp.name;
      wp.zone = this.inputWpZone.value.trim();
      wp.floor = parseInt(this.inputWpFloor.value, 10) || 1;
      wp.status = this.selectWpStatus.value as WaypointStatus;
      wp.locked = this.chkWpLocked.checked;

      const x = parseFloat(this.inputWpPosX.value);
      const y = parseFloat(this.inputWpPosY.value);
      const z = parseFloat(this.inputWpPosZ.value);
      if (!isNaN(x)) wp.position.x = x;
      if (!isNaN(y)) wp.position.y = y;
      if (!isNaN(z)) wp.position.z = z;

      this.store.updateWaypoint(wp, true);
    };

    if (this.inputWpName) this.inputWpName.addEventListener('change', handleWpChange);
    if (this.inputWpZone) this.inputWpZone.addEventListener('change', handleWpChange);
    if (this.inputWpFloor) this.inputWpFloor.addEventListener('change', handleWpChange);
    if (this.selectWpStatus) this.selectWpStatus.addEventListener('change', handleWpChange);
    if (this.chkWpLocked) this.chkWpLocked.addEventListener('change', handleWpChange);
    if (this.inputWpPosX) this.inputWpPosX.addEventListener('change', handleWpChange);
    if (this.inputWpPosY) this.inputWpPosY.addEventListener('change', handleWpChange);
    if (this.inputWpPosZ) this.inputWpPosZ.addEventListener('change', handleWpChange);

    if (this.btnCreateEdgeManual) {
      this.btnCreateEdgeManual.addEventListener('click', () => {
        const wp = this.store.getSelectedWaypoint();
        const targetId = this.selectConnectTarget.value;
        if (wp && targetId && targetId !== wp.id) {
          const edge = this.store.createEdge(wp.id, targetId, {
            direction: 'bidirectional',
            status: 'valid',
          }, false);
          if (edge) {
            const cmd = new AddEdgeCommand(this.store, edge);
            this.history.execute(cmd);
          }
        }
      });
    }

    if (this.btnWpDuplicate) {
      this.btnWpDuplicate.addEventListener('click', () => {
        const wp = this.store.getSelectedWaypoint();
        if (wp) {
          this.store.duplicateWaypoint(wp.id);
        }
      });
    }

    if (this.btnWpDelete) {
      this.btnWpDelete.addEventListener('click', () => {
        const wp = this.store.getSelectedWaypoint();
        if (wp && confirm(`Xóa Waypoint "${wp.name}"?`)) {
          const cmd = new DeleteGlobalWaypointCommand(this.store, wp, this.pathStore);
          this.history.execute(cmd);
        }
      });
    }

    // Edge inputs
    const handleEdgeChange = () => {
      if (this.isInternalUpdate) return;
      const edge = this.store.getSelectedEdge();
      if (!edge) return;

      const oldEdge = JSON.parse(JSON.stringify(edge));
      edge.direction = this.selectEdgeDirection.value as EdgeDirection;
      edge.status = this.selectEdgeStatus.value as EdgeStatus;
      edge.costWeight = parseFloat(this.inputEdgeCostWeight.value) || 1.0;

      const cmd = new UpdateEdgeCommand(this.store, oldEdge, edge);
      this.history.execute(cmd);
    };

    if (this.selectEdgeDirection) this.selectEdgeDirection.addEventListener('change', handleEdgeChange);
    if (this.selectEdgeStatus) this.selectEdgeStatus.addEventListener('change', handleEdgeChange);
    if (this.inputEdgeCostWeight) this.inputEdgeCostWeight.addEventListener('change', handleEdgeChange);

    if (this.btnConfirmSafe) {
      this.btnConfirmSafe.addEventListener('click', () => {
        const edge = this.store.getSelectedEdge();
        if (edge) {
          const oldEdge = JSON.parse(JSON.stringify(edge));
          edge.status = 'valid';
          edge.confirmedByAdmin = true;
          const cmd = new UpdateEdgeCommand(this.store, oldEdge, edge);
          this.history.execute(cmd);
          this.onEdgeAdminConfirmed?.(edge);
        }
      });
    }

    if (this.btnRetestCollision) {
      this.btnRetestCollision.addEventListener('click', () => {
        const edge = this.store.getSelectedEdge();
        if (edge) {
          this.onRetestEdge?.(edge);
        }
      });
    }

    if (this.btnDeleteEdge) {
      this.btnDeleteEdge.addEventListener('click', () => {
        const edge = this.store.getSelectedEdge();
        if (edge && confirm(`Xóa cạnh kết nối này?`)) {
          const cmd = new DeleteEdgeCommand(this.store, edge);
          this.history.execute(cmd);
        }
      });
    }
  }

  public updateCoords(pos: { x: number; y: number; z: number }): void {
    if (this.inputWpPosX) this.inputWpPosX.value = pos.x.toFixed(2);
    if (this.inputWpPosY) this.inputWpPosY.value = pos.y.toFixed(2);
    if (this.inputWpPosZ) this.inputWpPosZ.value = pos.z.toFixed(2);
  }

  public updateFromStore(): void {
    const selectedWp = this.store.getSelectedWaypoint();
    const selectedEdge = this.store.getSelectedEdge();

    if (!selectedWp && !selectedEdge) {
      if (this.emptyState) this.emptyState.style.display = 'block';
      if (this.wpForm) this.wpForm.style.display = 'none';
      if (this.edgeForm) this.edgeForm.style.display = 'none';
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';

    this.isInternalUpdate = true;

    if (selectedWp) {
      if (this.wpForm) this.wpForm.style.display = 'block';
      if (this.edgeForm) this.edgeForm.style.display = 'none';

      this.inputWpName.value = selectedWp.name;
      this.inputWpId.value = selectedWp.id;
      this.inputWpZone.value = selectedWp.zone || '';
      this.inputWpFloor.value = `${selectedWp.floor || 1}`;
      this.selectWpStatus.value = selectedWp.status || 'active';
      this.chkWpLocked.checked = selectedWp.locked || false;

      this.inputWpPosX.value = selectedWp.position.x.toFixed(2);
      this.inputWpPosY.value = selectedWp.position.y.toFixed(2);
      this.inputWpPosZ.value = selectedWp.position.z.toFixed(2);

      // Render connected neighbors
      this.renderNeighbors(selectedWp.id);

      // Populate connect target dropdown
      this.populateConnectDropdown(selectedWp.id);
    } else if (selectedEdge) {
      if (this.wpForm) this.wpForm.style.display = 'none';
      if (this.edgeForm) this.edgeForm.style.display = 'block';

      const wpA = this.store.getWaypoint(selectedEdge.fromWaypointId);
      const wpB = this.store.getWaypoint(selectedEdge.toWaypointId);

      this.txtEdgeFrom.textContent = wpA ? wpA.name : selectedEdge.fromWaypointId.slice(0, 8);
      this.txtEdgeTo.textContent = wpB ? wpB.name : selectedEdge.toWaypointId.slice(0, 8);
      this.selectEdgeDirection.value = selectedEdge.direction;
      this.selectEdgeStatus.value = selectedEdge.status;
      this.txtEdgeDistance.textContent = `${selectedEdge.distance.toFixed(2)}m`;
      this.txtEdgeDuration.textContent = `${(selectedEdge.estimatedDurationSeconds || 0).toFixed(1)}s`;
      this.inputEdgeCostWeight.value = `${selectedEdge.costWeight || 1.0}`;

      if (this.badgeAdminConfirmed) {
        this.badgeAdminConfirmed.style.display = selectedEdge.confirmedByAdmin ? 'flex' : 'none';
      }
      if (this.btnConfirmSafe) {
        if (selectedEdge.confirmedByAdmin) {
          this.btnConfirmSafe.innerHTML = `<i data-lucide="shield-check"></i> <span>Đã cưỡng chế an toàn</span>`;
          this.btnConfirmSafe.style.opacity = '0.7';
        } else {
          this.btnConfirmSafe.innerHTML = `<i data-lucide="shield-check"></i> <span>Cưỡng chế an toàn</span>`;
          this.btnConfirmSafe.style.opacity = '1';
        }
        if ((window as any).lucide) (window as any).lucide.createIcons();
      }
    }

    this.isInternalUpdate = false;
  }

  private renderNeighbors(waypointId: string): void {
    if (!this.neighborsContainer) return;

    const neighbors = this.store.getNeighbors(waypointId);
    if (neighbors.length === 0) {
      this.neighborsContainer.innerHTML = `
        <div style="font-size: 11px; color: var(--text-dim); padding: 8px 0;">
          Chưa có cạnh kết nối nào (Điểm cô lập).
        </div>
      `;
      return;
    }

    this.neighborsContainer.innerHTML = '';
    for (const item of neighbors) {
      const neighborEl = document.createElement('div');
      neighborEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        margin-bottom: 4px;
        font-size: 12px;
      `;

      let statusColor = '#10b981';
      if (item.edge.status === 'blocked') statusColor = '#ef4444';
      else if (item.edge.status === 'needs_confirmation') statusColor = '#f59e0b';
      else if (item.edge.status === 'untested') statusColor = '#94a3b8';

      neighborEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
          <span style="font-weight: 500; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${item.waypoint.name}
          </span>
          <span style="font-size: 10px; color: var(--text-muted);">
            (${item.edge.distance.toFixed(1)}m)
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn-icon-xs btn-inspect-edge" title="Xem thuộc tính cạnh">
            <i data-lucide="info" style="width: 12px; height: 12px;"></i>
          </button>
          <button class="btn-icon-xs btn-remove-edge" title="Xóa liên kết" style="color: #ef4444;">
            <i data-lucide="x" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      `;

      neighborEl.querySelector('.btn-inspect-edge')?.addEventListener('click', () => {
        this.store.selectEdge(item.edge.id);
      });

      neighborEl.querySelector('.btn-remove-edge')?.addEventListener('click', () => {
        if (confirm(`Xóa liên kết tới "${item.waypoint.name}"?`)) {
          const cmd = new DeleteEdgeCommand(this.store, item.edge);
          this.history.execute(cmd);
        }
      });

      this.neighborsContainer.appendChild(neighborEl);
    }

    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  private populateConnectDropdown(currentWpId: string): void {
    if (!this.selectConnectTarget) return;

    const allWps = this.store.getAllWaypoints().filter((w) => w.id !== currentWpId);
    this.selectConnectTarget.innerHTML = `<option value="">(Chọn điểm cần kết nối)</option>`;

    for (const wp of allWps) {
      const alreadyConnected = !!this.store.getEdgeBetween(currentWpId, wp.id);
      if (!alreadyConnected) {
        const opt = document.createElement('option');
        opt.value = wp.id;
        opt.textContent = `${wp.name} (${wp.zone || `Tầng ${wp.floor || 1}`})`;
        this.selectConnectTarget.appendChild(opt);
      }
    }
  }
}

