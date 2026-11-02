import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { CameraWaypoint } from '../types/cameraPath.types';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { DeleteGlobalWaypointCommand } from '../commands/DeleteGlobalWaypointCommand';
import { CameraPathStore } from '../store/CameraPathStore';

export class GraphPanel {
  private store: WaypointGraphStore;
  private pathStore: CameraPathStore;
  private history: CommandHistory;

  private container: HTMLElement;
  private searchInput: HTMLInputElement;
  private filterSelect: HTMLSelectElement;
  private listContainer: HTMLElement;
  private countBadgeWp: HTMLElement;
  private countBadgeEdge: HTMLElement;

  private inputRadius: HTMLInputElement;
  private valRadius: HTMLElement;
  private inputHeight: HTMLInputElement;
  private valHeight: HTMLElement;
  private btnRunAutoConnect: HTMLButtonElement;

  private onAddWaypointRequested?: () => void;
  private onDiagnoseRequested?: () => void;
  private onLocateWaypoint?: (wp: CameraWaypoint) => void;
  private onRunAutoConnect?: (radius: number, height: number) => void;

  constructor(
    store: WaypointGraphStore,
    pathStore: CameraPathStore,
    history: CommandHistory,
    callbacks: {
      onAddWaypointRequested?: () => void;
      onDiagnoseRequested?: () => void;
      onLocateWaypoint?: (wp: CameraWaypoint) => void;
      onRunAutoConnect?: (radius: number, height: number) => void;
    } = {}
  ) {
    this.store = store;
    this.pathStore = pathStore;
    this.history = history;
    this.onAddWaypointRequested = callbacks.onAddWaypointRequested;
    this.onDiagnoseRequested = callbacks.onDiagnoseRequested;
    this.onLocateWaypoint = callbacks.onLocateWaypoint;
    this.onRunAutoConnect = callbacks.onRunAutoConnect;

    this.container = document.getElementById('panel-graph-content')!;
    this.searchInput = document.getElementById('graph-search-input') as HTMLInputElement;
    this.filterSelect = document.getElementById('graph-filter-select') as HTMLSelectElement;
    this.listContainer = document.getElementById('graph-waypoint-list')!;
    this.countBadgeWp = document.getElementById('graph-wp-count-badge')!;
    this.countBadgeEdge = document.getElementById('graph-edge-count-badge')!;

    this.inputRadius = document.getElementById('prop-autoconnect-radius') as HTMLInputElement;
    this.valRadius = document.getElementById('val-autoconnect-radius')!;
    this.inputHeight = document.getElementById('prop-autoconnect-height') as HTMLInputElement;
    this.valHeight = document.getElementById('val-autoconnect-height')!;
    this.btnRunAutoConnect = document.getElementById('btn-run-autoconnect') as HTMLButtonElement;

    this.bindEvents();
    this.store.subscribe(() => this.render());
  }

  private bindEvents(): void {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.render());
    }

    if (this.filterSelect) {
      this.filterSelect.addEventListener('change', () => this.render());
    }

    if (this.inputRadius && this.valRadius) {
      this.inputRadius.addEventListener('input', () => {
        this.valRadius.textContent = `${this.inputRadius.value}m`;
      });
    }

    if (this.inputHeight && this.valHeight) {
      this.inputHeight.addEventListener('input', () => {
        this.valHeight.textContent = `${this.inputHeight.value}m`;
      });
    }

    if (this.btnRunAutoConnect) {
      this.btnRunAutoConnect.addEventListener('click', () => {
        const radius = parseFloat(this.inputRadius.value) || 8.0;
        const height = parseFloat(this.inputHeight.value) || 1.5;
        this.onRunAutoConnect?.(radius, height);
      });
    }

    const btnAddWp = document.getElementById('btn-add-global-wp-left');
    if (btnAddWp) {
      btnAddWp.addEventListener('click', () => this.onAddWaypointRequested?.());
    }

    const btnDiag = document.getElementById('btn-diagnose-graph-left');
    if (btnDiag) {
      btnDiag.addEventListener('click', () => this.onDiagnoseRequested?.());
    }
  }

  public render(): void {
    if (!this.listContainer) return;

    const waypoints = this.store.getAllWaypoints();
    const edges = this.store.getAllEdges();

    if (this.countBadgeWp) this.countBadgeWp.textContent = `${waypoints.length}`;
    if (this.countBadgeEdge) this.countBadgeEdge.textContent = `${edges.length}`;

    const query = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    const filter = this.filterSelect ? this.filterSelect.value : 'all';

    const selectedId = this.store.getSelectedWaypointId();

    const filtered = waypoints.filter((wp) => {
      // Query match
      const matchQuery =
        !query ||
        wp.name.toLowerCase().includes(query) ||
        (wp.zone && wp.zone.toLowerCase().includes(query)) ||
        wp.id.toLowerCase().includes(query);

      if (!matchQuery) return false;

      // Filter match
      const edgeCount = this.store.getEdgesForWaypoint(wp.id).length;
      if (filter === 'isolated') return edgeCount === 0;
      if (filter === 'connected') return edgeCount > 0;
      if (filter === 'draft') return wp.status === 'draft';
      if (filter === 'active') return wp.status === 'active';

      return true;
    });

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-dim); font-size: 12px;">
          <i data-lucide="network" style="width: 28px; height: 28px; margin: 0 auto 8px; opacity: 0.4; display: block;"></i>
          ${waypoints.length === 0 ? 'Chưa có Waypoint toàn cục nào.<br>Bấm "+ Thêm Waypoint" để đặt lên mô hình.' : 'Không tìm thấy Waypoint phù hợp.'}
        </div>
      `;
      if ((window as any).lucide) (window as any).lucide.createIcons();
      return;
    }

    this.listContainer.innerHTML = '';

    for (const wp of filtered) {
      const isSelected = wp.id === selectedId;
      const edgeCount = this.store.getEdgesForWaypoint(wp.id).length;
      const isIsolated = edgeCount === 0;

      const itemEl = document.createElement('div');
      itemEl.className = `waypoint-item-card ${isSelected ? 'selected' : ''}`;
      itemEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin-bottom: 6px;
        background: ${isSelected ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-card)'};
        border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'};
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isIsolated ? '#f97316' : '#0ea5e9'}; flex-shrink: 0;"></span>
          <div style="min-width: 0;">
            <div style="font-weight: 500; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${wp.name}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              <span>${wp.zone ? wp.zone : `Tầng ${wp.floor || 1}`}</span>
              <span style="color: var(--border-subtle);">•</span>
              <span style="color: ${isIsolated ? '#f97316' : '#10b981'}; font-weight: 500;">
                ${isIsolated ? 'Cô lập' : `${edgeCount} liên kết`}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <button class="btn-icon-xs btn-locate-wp" title="Đưa góc nhìn tới Waypoint này" style="opacity: 0.7;">
            <i data-lucide="crosshair" style="width: 14px; height: 14px;"></i>
          </button>
          <button class="btn-icon-xs btn-delete-wp" title="Xóa Waypoint này" style="color: #ef4444; opacity: 0.7;">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;

      itemEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-locate-wp')) {
          e.stopPropagation();
          this.onLocateWaypoint?.(wp);
          this.store.selectWaypoint(wp.id);
          return;
        }

        if ((e.target as HTMLElement).closest('.btn-delete-wp')) {
          e.stopPropagation();
          if (confirm(`Bạn có chắc chắn muốn xóa Waypoint "${wp.name}"?`)) {
            const cmd = new DeleteGlobalWaypointCommand(this.store, wp, this.pathStore);
            this.history.execute(cmd);
          }
          return;
        }

        this.store.selectWaypoint(wp.id);
      });

      this.listContainer.appendChild(itemEl);
    }

    if ((window as any).lucide) (window as any).lucide.createIcons();
  }
}

