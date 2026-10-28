import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem, HotspotFilterType, HotspotSortType } from '../types/hotspot.types';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { DeleteHotspotCommand } from '../commands/DeleteHotspotCommand';
import { DuplicateHotspotCommand } from '../commands/DuplicateHotspotCommand';
import { BulkHotspotCommand } from '../commands/BulkHotspotCommand';
import { UpdateHotspotCommand } from '../commands/UpdateHotspotCommand';
import { EventBus, EditorEvents } from '../../../shared/events/EventBus';

export class HotspotListPanel {
  private store: HotspotStore;
  private history: CommandHistory;
  private container: HTMLElement;
  private countBadge: HTMLElement;
  private searchInput: HTMLInputElement;
  private btnClearSearch: HTMLElement;
  private filterSelect: HTMLSelectElement;
  private sortSelect: HTMLSelectElement;
  private bulkActionBar: HTMLElement;
  private selectAllCheckbox: HTMLInputElement;
  private selectedCountLabel: HTMLElement;

  private onConfirmDeletePrompt?: (items: HotspotItem[]) => void;

  constructor(
    store: HotspotStore,
    history: CommandHistory,
    onConfirmDeletePrompt?: (items: HotspotItem[]) => void
  ) {
    this.store = store;
    this.history = history;
    this.onConfirmDeletePrompt = onConfirmDeletePrompt;

    this.container = document.getElementById('hotspots-list-container')!;
    this.countBadge = document.getElementById('hotspots-count-badge')!;
    this.searchInput = document.getElementById('hotspot-search-input') as HTMLInputElement;
    this.btnClearSearch = document.getElementById('btn-clear-search')!;
    this.filterSelect = document.getElementById('hotspot-filter-select') as HTMLSelectElement;
    this.sortSelect = document.getElementById('hotspot-sort-select') as HTMLSelectElement;
    this.bulkActionBar = document.getElementById('bulk-action-bar')!;
    this.selectAllCheckbox = document.getElementById('select-all-hotspots-checkbox') as HTMLInputElement;
    this.selectedCountLabel = document.getElementById('selected-count-label')!;

    this.bindEvents();
    this.store.subscribe(() => this.render());
  }

  private bindEvents(): void {
    this.searchInput.addEventListener('input', () => {
      this.store.setSearchQuery(this.searchInput.value);
      this.btnClearSearch.style.display = this.searchInput.value ? 'block' : 'none';
    });

    this.btnClearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.store.setSearchQuery('');
      this.btnClearSearch.style.display = 'none';
    });

    this.filterSelect.addEventListener('change', () => {
      this.store.setFilter(this.filterSelect.value as HotspotFilterType);
    });

    this.sortSelect.addEventListener('change', () => {
      this.store.setSort(this.sortSelect.value as HotspotSortType);
    });

    this.selectAllCheckbox.addEventListener('change', () => {
      if (this.selectAllCheckbox.checked) {
        this.store.selectAll();
      } else {
        this.store.deselectAll();
      }
    });

    // Bulk actions
    document.getElementById('btn-bulk-toggle-visibility')?.addEventListener('click', () => {
      const selectedIds = this.store.getMultiSelectedIds();
      if (selectedIds.length === 0) return;
      const first = this.store.getById(selectedIds[0]);
      const nextVis = first ? !first.visible : true;
      this.history.execute(
        new BulkHotspotCommand(
          this.store,
          selectedIds,
          (item) => (item.visible = nextVis),
          nextVis ? 'Hiện' : 'Ẩn'
        )
      );
    });

    document.getElementById('btn-bulk-color')?.addEventListener('click', () => {
      const selectedIds = this.store.getMultiSelectedIds();
      if (selectedIds.length === 0) return;
      const color = prompt('Nhập mã màu HEX mới cho các hotspot đã chọn (e.g. #00E5FF):', '#00E5FF');
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        this.history.execute(
          new BulkHotspotCommand(
            this.store,
            selectedIds,
            (item) => (item.marker.color = color),
            'Đổi màu'
          )
        );
      }
    });

    document.getElementById('btn-bulk-delete')?.addEventListener('click', () => {
      const selectedIds = this.store.getMultiSelectedIds();
      if (selectedIds.length === 0) return;
      const items = selectedIds.map((id) => this.store.getById(id)).filter(Boolean) as HotspotItem[];
      if (this.onConfirmDeletePrompt) {
        this.onConfirmDeletePrompt(items);
      } else {
        this.history.execute(new DeleteHotspotCommand(this.store, items));
      }
    });
  }

  public render(): void {
    const items = this.store.getFilteredAndSorted();
    const totalCount = this.store.getCount();
    const selectedIds = this.store.getMultiSelectedIds();
    const activeSelectedId = this.store.getSelectedId();

    this.countBadge.textContent = String(totalCount);

    // Bulk bar visibility
    if (selectedIds.length > 1) {
      this.bulkActionBar.style.display = 'flex';
      this.selectedCountLabel.textContent = `Đã chọn ${selectedIds.length} mục`;
      this.selectAllCheckbox.checked = selectedIds.length === totalCount && totalCount > 0;
    } else {
      this.bulkActionBar.style.display = 'none';
      this.selectAllCheckbox.checked = false;
    }

    if (items.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state-card">
          <i data-lucide="map-pin" class="empty-icon"></i>
          <p class="empty-title">${totalCount === 0 ? 'Chưa có hotspot nào' : 'Không tìm thấy kết quả'}</p>
          <p class="empty-desc">${
            totalCount === 0
              ? 'Nhấn nút "Thêm Hotspot" hoặc nạp file có sẵn candidate nodes.'
              : 'Thử tìm với từ khóa khác hoặc điều chỉnh bộ lọc.'
          }</p>
        </div>
      `;
      if ((window as any).lucide) (window as any).lucide.createIcons();
      return;
    }

    this.container.innerHTML = '';

    items.forEach((item, index) => {
      const isSelected = item.id === activeSelectedId || selectedIds.includes(item.id);
      const isMulti = selectedIds.includes(item.id);

      const card = document.createElement('div');
      card.className = `hotspot-item-card ${isSelected ? 'selected' : ''} ${!item.visible ? 'hidden-marker' : ''}`;
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="item-left">
          <input type="checkbox" class="item-select-checkbox" data-id="${item.id}" ${isMulti ? 'checked' : ''} />
          <div class="item-badge-index" style="border: 2px solid ${item.marker.color || '#00e5ff'}">${index + 1}</div>
          <div class="item-details">
            <div class="item-name-row">
              <span class="item-title" title="${item.name}">${item.name}</span>
              <span class="item-tag-source ${item.source.kind === 'imported' ? 'imported' : ''}">${
        item.source.kind === 'imported' ? 'FILE' : 'USER'
      }</span>
            </div>
            <span class="item-coords">X:${item.position.x} Y:${item.position.y} Z:${item.position.z}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-icon-xs btn-focus-item" data-id="${item.id}" title="Focus camera">
            <i data-lucide="crosshair"></i>
          </button>
          <button class="btn-icon-xs btn-toggle-vis" data-id="${item.id}" title="${item.visible ? 'Ẩn' : 'Hiện'}">
            <i data-lucide="${item.visible ? 'eye' : 'eye-off'}"></i>
          </button>
          <button class="btn-icon-xs btn-toggle-lock" data-id="${item.id}" title="${item.locked ? 'Mở khóa' : 'Khóa'}">
            <i data-lucide="${item.locked ? 'lock' : 'unlock'}"></i>
          </button>
          <button class="btn-icon-xs btn-dup-item" data-id="${item.id}" title="Nhân bản">
            <i data-lucide="copy"></i>
          </button>
          <button class="btn-icon-xs btn-danger-xs btn-del-item" data-id="${item.id}" title="Xóa">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Click card to select
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.item-actions') || target.closest('.item-select-checkbox')) {
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          this.store.toggleMultiSelect(item.id);
        } else {
          this.store.select(item.id);
        }
      });

      // Checkbox click
      const chk = card.querySelector('.item-select-checkbox') as HTMLInputElement;
      chk?.addEventListener('change', (e) => {
        e.stopPropagation();
        this.store.toggleMultiSelect(item.id);
      });

      // Action: Focus
      card.querySelector('.btn-focus-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.select(item.id);
        EventBus.getInstance().emit(EditorEvents.HOTSPOT_FOCUS_REQUESTED, item);
      });

      // Action: Visibility Toggle
      card.querySelector('.btn-toggle-vis')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = { ...item, visible: !item.visible };
        this.history.execute(new UpdateHotspotCommand(this.store, item, next, 'trạng thái ẩn/hiện'));
      });

      // Action: Lock Toggle
      card.querySelector('.btn-toggle-lock')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = { ...item, locked: !item.locked };
        this.history.execute(new UpdateHotspotCommand(this.store, item, next, 'trạng thái khóa'));
      });

      // Action: Duplicate
      card.querySelector('.btn-dup-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.history.execute(new DuplicateHotspotCommand(this.store, item));
      });

      // Action: Delete
      card.querySelector('.btn-del-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onConfirmDeletePrompt) {
          this.onConfirmDeletePrompt([item]);
        } else {
          this.history.execute(new DeleteHotspotCommand(this.store, item));
        }
      });

      this.container.appendChild(card);
    });

    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }
}
