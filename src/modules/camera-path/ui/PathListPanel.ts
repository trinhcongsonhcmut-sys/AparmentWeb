import { CameraPathStore } from '../store/CameraPathStore';
import { HotspotStore } from '../../hotspots/store/HotspotStore';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { CreatePathCommand } from '../commands/CreatePathCommand';
import { DeletePathCommand } from '../commands/DeletePathCommand';
import { DeleteWaypointCommand } from '../commands/DeleteWaypointCommand';
import { ReorderWaypointCommand } from '../commands/ReorderWaypointCommand';
import { CameraPath, CameraWaypoint } from '../types/cameraPath.types';
import { EventBus, EditorEvents } from '../../../shared/events/EventBus';

export class PathListPanel {
  private pathStore: CameraPathStore;
  private hotspotStore: HotspotStore;
  private history: CommandHistory;

  private container: HTMLElement;
  private pathSelectDropdown: HTMLSelectElement;
  private btnNewPath: HTMLButtonElement;
  private btnAddWaypoint: HTMLButtonElement;
  private sequenceContainer: HTMLElement;

  private onRequestAddWaypoint?: () => void;
  private onPromptNewPath?: () => void;

  constructor(
    pathStore: CameraPathStore,
    hotspotStore: HotspotStore,
    history: CommandHistory,
    onRequestAddWaypoint?: () => void,
    onPromptNewPath?: () => void
  ) {
    this.pathStore = pathStore;
    this.hotspotStore = hotspotStore;
    this.history = history;
    this.onRequestAddWaypoint = onRequestAddWaypoint;
    this.onPromptNewPath = onPromptNewPath;

    this.container = document.getElementById('panel-camera-paths')!;
    this.pathSelectDropdown = document.getElementById('path-select-dropdown') as HTMLSelectElement;
    this.btnNewPath = document.getElementById('btn-create-path-trigger') as HTMLButtonElement;
    this.btnAddWaypoint = document.getElementById('btn-add-waypoint-trigger') as HTMLButtonElement;
    this.sequenceContainer = document.getElementById('waypoint-chain-container')!;

    this.bindEvents();
    this.pathStore.subscribe(() => this.render());
    this.hotspotStore.subscribe(() => this.render());
  }

  private bindEvents(): void {
    this.pathSelectDropdown.addEventListener('change', () => {
      this.pathStore.setActivePath(this.pathSelectDropdown.value || null);
    });

    this.btnNewPath.addEventListener('click', () => {
      this.onPromptNewPath?.();
    });

    const btnQuick = document.getElementById('btn-create-path-quick');
    btnQuick?.addEventListener('click', () => {
      this.onPromptNewPath?.();
    });

    this.btnAddWaypoint.addEventListener('click', () => {
      if (this.pathStore.getAllPaths().length === 0) {
        this.onPromptNewPath?.();
      } else {
        this.onRequestAddWaypoint?.();
      }
    });
  }

  public render(): void {
    const paths = this.pathStore.getAllPaths();
    const activePath = this.pathStore.getActivePath();

    // 1. Render Path Dropdown
    this.pathSelectDropdown.innerHTML = '';
    if (paths.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(Chưa có tuyến camera nào)';
      this.pathSelectDropdown.appendChild(opt);
      this.pathSelectDropdown.disabled = true;
    } else {
      this.pathSelectDropdown.disabled = false;
      paths.forEach((p) => {
        const fromH = this.hotspotStore.getById(p.fromHotspotId);
        const toH = this.hotspotStore.getById(p.toHotspotId);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${fromH?.name || 'H1'} → ${toH?.name || 'H2'})`;
        if (p.id === activePath?.id) opt.selected = true;
        this.pathSelectDropdown.appendChild(opt);
      });
    }

    // 2. Render Waypoints Sequence Chain
    if (!activePath) {
      this.sequenceContainer.innerHTML = `
        <div class="empty-state-card">
          <i data-lucide="route" class="empty-icon"></i>
          <p class="empty-title">Chưa có tuyến camera nào</p>
          <p class="empty-desc">Nhấn nút bên dưới để tạo tuyến hành trình nối giữa hai Hotspot.</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-state-create-path" style="margin-top: 12px; background: var(--accent-purple); cursor: pointer;">
            <i data-lucide="plus"></i>
            <span>+ Tạo Tuyến Camera Mới</span>
          </button>
        </div>
      `;
      document.getElementById('btn-empty-state-create-path')?.addEventListener('click', () => {
        this.onPromptNewPath?.();
      });
      if ((window as any).lucide) (window as any).lucide.createIcons();
      return;
    }

    const fromHotspot = this.hotspotStore.getById(activePath.fromHotspotId);
    const toHotspot = this.hotspotStore.getById(activePath.toHotspotId);
    const waypoints = this.pathStore.getWaypointsForPath(activePath.id);
    const selectedWpId = this.pathStore.getSelectedWaypointId();

    this.sequenceContainer.innerHTML = '';

    // A. Start Hotspot Card
    const startCard = document.createElement('div');
    startCard.className = 'waypoint-item-card terminal-node';
    startCard.innerHTML = `
      <div class="wp-badge terminal">START</div>
      <div class="wp-details">
        <span class="wp-title">${fromHotspot?.name || 'Điểm xuất phát'}</span>
        <span class="wp-meta">Hotspot gốc</span>
      </div>
    `;
    this.sequenceContainer.appendChild(startCard);

    // B. Intermediate Waypoints
    waypoints.forEach((wp, index) => {
      const isSelected = wp.id === selectedWpId;
      const card = document.createElement('div');
      card.className = `waypoint-item-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="wp-badge">P${index + 1}</div>
        <div class="wp-details">
          <span class="wp-title">${wp.name}</span>
          <span class="wp-meta">X:${wp.position.x} Y:${wp.position.y} Z:${wp.position.z}</span>
        </div>
        <div class="wp-reorder-buttons">
          <button class="btn-icon-xs btn-move-up" title="Đẩy lên" ${index === 0 ? 'disabled' : ''}>
            <i data-lucide="chevron-up"></i>
          </button>
          <button class="btn-icon-xs btn-move-down" title="Đẩy xuống" ${index === waypoints.length - 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-down"></i>
          </button>
          <button class="btn-icon-xs btn-danger-xs btn-del-wp" title="Xóa waypoint">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.wp-reorder-buttons')) return;
        this.pathStore.selectWaypoint(wp.id);
      });

      // Move Up
      card.querySelector('.btn-move-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index > 0) {
          const newSeq = [...activePath.waypointIds];
          const temp = newSeq[index - 1];
          newSeq[index - 1] = newSeq[index];
          newSeq[index] = temp;
          this.history.execute(new ReorderWaypointCommand(this.pathStore, activePath.id, activePath.waypointIds, newSeq));
        }
      });

      // Move Down
      card.querySelector('.btn-move-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index < waypoints.length - 1) {
          const newSeq = [...activePath.waypointIds];
          const temp = newSeq[index + 1];
          newSeq[index + 1] = newSeq[index];
          newSeq[index] = temp;
          this.history.execute(new ReorderWaypointCommand(this.pathStore, activePath.id, activePath.waypointIds, newSeq));
        }
      });

      // Delete Waypoint
      card.querySelector('.btn-del-wp')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.history.execute(new DeleteWaypointCommand(this.pathStore, wp, activePath.id));
      });

      this.sequenceContainer.appendChild(card);
    });

    // C. Destination Hotspot Card
    const endCard = document.createElement('div');
    endCard.className = 'waypoint-item-card terminal-node';
    endCard.innerHTML = `
      <div class="wp-badge terminal">END</div>
      <div class="wp-details">
        <span class="wp-title">${toHotspot?.name || 'Điểm đích'}</span>
        <span class="wp-meta">Hotspot đích</span>
      </div>
    `;
    this.sequenceContainer.appendChild(endCard);

    if ((window as any).lucide) (window as any).lucide.createIcons();
  }
}
