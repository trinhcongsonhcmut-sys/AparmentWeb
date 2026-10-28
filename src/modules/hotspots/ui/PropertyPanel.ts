import { HotspotStore } from '../store/HotspotStore';
import { HotspotItem } from '../types/hotspot.types';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { UpdateHotspotCommand } from '../commands/UpdateHotspotCommand';
import { DuplicateHotspotCommand } from '../commands/DuplicateHotspotCommand';
import { DeleteHotspotCommand } from '../commands/DeleteHotspotCommand';
import { EventBus, EditorEvents } from '../../../shared/events/EventBus';
import { MathUtils } from '../../../shared/math/MathUtils';

export class PropertyPanel {
  private store: HotspotStore;
  private history: CommandHistory;
  private onConfirmDelete?: (item: HotspotItem) => void;

  private emptyState: HTMLElement;
  private formContainer: HTMLElement;

  // Form Fields
  private inputName: HTMLInputElement;
  private inputId: HTMLInputElement;
  private selectType: HTMLSelectElement;
  private textareaNotes: HTMLTextAreaElement;

  private inputPosX: HTMLInputElement;
  private inputPosY: HTMLInputElement;
  private inputPosZ: HTMLInputElement;

  private inputRotY: HTMLInputElement;
  private inputRotX: HTMLInputElement;
  private inputRotZ: HTMLInputElement;

  private inputColor: HTMLInputElement;
  private inputSize: HTMLInputElement;
  private labelSizeVal: HTMLElement;
  private chkShowBadge: HTMLInputElement;

  private chkVisible: HTMLInputElement;
  private chkLocked: HTMLInputElement;

  private txtSourceKind: HTMLElement;
  private rowSourceNode: HTMLElement;
  private txtSourceNode: HTMLElement;
  private txtUpdatedAt: HTMLElement;

  private currentItem: HotspotItem | null = null;
  private isInternalUpdate: boolean = false;

  constructor(
    store: HotspotStore,
    history: CommandHistory,
    onConfirmDelete?: (item: HotspotItem) => void
  ) {
    this.store = store;
    this.history = history;
    this.onConfirmDelete = onConfirmDelete;

    this.emptyState = document.getElementById('inspector-empty-state')!;
    this.formContainer = document.getElementById('inspector-form')!;

    this.inputName = document.getElementById('prop-name') as HTMLInputElement;
    this.inputId = document.getElementById('prop-id') as HTMLInputElement;
    this.selectType = document.getElementById('prop-type') as HTMLSelectElement;
    this.textareaNotes = document.getElementById('prop-notes') as HTMLTextAreaElement;

    this.inputPosX = document.getElementById('prop-pos-x') as HTMLInputElement;
    this.inputPosY = document.getElementById('prop-pos-y') as HTMLInputElement;
    this.inputPosZ = document.getElementById('prop-pos-z') as HTMLInputElement;

    this.inputRotY = document.getElementById('prop-rot-y') as HTMLInputElement;
    this.inputRotX = document.getElementById('prop-rot-x') as HTMLInputElement;
    this.inputRotZ = document.getElementById('prop-rot-z') as HTMLInputElement;

    this.inputColor = document.getElementById('prop-marker-color') as HTMLInputElement;
    this.inputSize = document.getElementById('prop-marker-size') as HTMLInputElement;
    this.labelSizeVal = document.getElementById('marker-size-val')!;
    this.chkShowBadge = document.getElementById('prop-show-badge') as HTMLInputElement;

    this.chkVisible = document.getElementById('prop-visible') as HTMLInputElement;
    this.chkLocked = document.getElementById('prop-locked') as HTMLInputElement;

    this.txtSourceKind = document.getElementById('prop-source-kind')!;
    this.rowSourceNode = document.getElementById('source-node-row')!;
    this.txtSourceNode = document.getElementById('prop-source-nodepath')!;
    this.txtUpdatedAt = document.getElementById('prop-updated-at')!;

    this.bindEvents();
    this.store.subscribe(() => this.updateFromStore());
  }

  private bindEvents(): void {
    // Copy ID button
    document.getElementById('btn-copy-id')?.addEventListener('click', () => {
      if (this.inputId.value) {
        navigator.clipboard.writeText(this.inputId.value);
        EventBus.getInstance().emit(EditorEvents.SHOW_TOAST, {
          type: 'success',
          message: 'Đã sao chép ID hotspot vào clipboard!',
        });
      }
    });

    // Name change (commit on change / blur)
    this.inputName.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = { ...this.currentItem, name: this.inputName.value.trim() || 'Hotspot chưa đặt tên' };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'tên'));
    });

    // Type change
    this.selectType.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = { ...this.currentItem, type: this.selectType.value as any };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'phân loại'));
    });

    // Notes change
    this.textareaNotes.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = { ...this.currentItem, notes: this.textareaNotes.value };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'ghi chú'));
    });

    // Position numeric changes
    const onCoordChange = () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const x = parseFloat(this.inputPosX.value) || 0;
      const y = parseFloat(this.inputPosY.value) || 0;
      const z = parseFloat(this.inputPosZ.value) || 0;
      const next = {
        ...this.currentItem,
        position: { x: MathUtils.round(x, 2), y: MathUtils.round(y, 2), z: MathUtils.round(z, 2) },
      };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'tọa độ'));
    };

    this.inputPosX.addEventListener('change', onCoordChange);
    this.inputPosY.addEventListener('change', onCoordChange);
    this.inputPosZ.addEventListener('change', onCoordChange);

    // Rotation numeric changes
    const onRotChange = () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const rotY = parseFloat(this.inputRotY.value) || 0;
      const rotX = parseFloat(this.inputRotX.value) || 0;
      const rotZ = parseFloat(this.inputRotZ.value) || 0;
      const next = {
        ...this.currentItem,
        rotation: { x: Math.round(rotX), y: Math.round(rotY), z: Math.round(rotZ) },
      };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'góc xoay'));
    };

    this.inputRotY.addEventListener('change', onRotChange);
    this.inputRotX.addEventListener('change', onRotChange);
    this.inputRotZ.addEventListener('change', onRotChange);

    // Color presets
    const presetButtons = document.querySelectorAll('.color-preset');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.currentItem) return;
        const color = (btn as HTMLElement).dataset.color || '#00e5ff';
        this.inputColor.value = color;
        presetButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const next = {
          ...this.currentItem,
          marker: { ...this.currentItem.marker, color },
        };
        this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'màu sắc'));
      });
    });

    // Custom Color picker
    this.inputColor.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const color = this.inputColor.value;
      const next = {
        ...this.currentItem,
        marker: { ...this.currentItem.marker, color },
      };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'màu sắc'));
    });

    // Size slider
    this.inputSize.addEventListener('input', () => {
      this.labelSizeVal.textContent = `${this.inputSize.value}x`;
    });

    this.inputSize.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const size = parseFloat(this.inputSize.value);
      const next = {
        ...this.currentItem,
        marker: { ...this.currentItem.marker, size },
      };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'kích thước'));
    });

    // Show Badge toggle
    this.chkShowBadge.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = {
        ...this.currentItem,
        marker: { ...this.currentItem.marker, showBadge: this.chkShowBadge.checked },
      };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'hiển thị số'));
    });

    // Visibility toggle
    this.chkVisible.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = { ...this.currentItem, visible: this.chkVisible.checked };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'trạng thái ẩn/hiện'));
    });

    // Lock toggle
    this.chkLocked.addEventListener('change', () => {
      if (!this.currentItem || this.isInternalUpdate) return;
      const next = { ...this.currentItem, locked: this.chkLocked.checked };
      this.history.execute(new UpdateHotspotCommand(this.store, this.currentItem, next, 'trạng thái khóa'));
    });

    // Duplicate button
    document.getElementById('btn-duplicate-hotspot')?.addEventListener('click', () => {
      if (!this.currentItem) return;
      this.history.execute(new DuplicateHotspotCommand(this.store, this.currentItem));
    });

    // Delete button
    document.getElementById('btn-delete-hotspot')?.addEventListener('click', () => {
      if (!this.currentItem) return;
      if (this.onConfirmDelete) {
        this.onConfirmDelete(this.currentItem);
      } else {
        this.history.execute(new DeleteHotspotCommand(this.store, this.currentItem));
      }
    });
  }

  public updateCoordsFromGizmo(pos: { x: number; y: number; z: number }, rot?: { x: number; y: number; z: number }): void {
    this.isInternalUpdate = true;
    this.inputPosX.value = String(MathUtils.round(pos.x, 2));
    this.inputPosY.value = String(MathUtils.round(pos.y, 2));
    this.inputPosZ.value = String(MathUtils.round(pos.z, 2));

    if (rot) {
      this.inputRotY.value = String(Math.round(rot.y));
      this.inputRotX.value = String(Math.round(rot.x));
      this.inputRotZ.value = String(Math.round(rot.z));
    }
    this.isInternalUpdate = false;
  }

  private updateFromStore(): void {
    const item = this.store.getSelectedItem();
    this.currentItem = item ? JSON.parse(JSON.stringify(item)) : null;

    if (!item) {
      this.emptyState.style.display = 'flex';
      this.formContainer.style.display = 'none';
      return;
    }

    this.emptyState.style.display = 'none';
    this.formContainer.style.display = 'block';

    this.isInternalUpdate = true;

    this.inputName.value = item.name;
    this.inputId.value = item.id;
    this.selectType.value = item.type;
    this.textareaNotes.value = item.notes || '';

    this.inputPosX.value = String(item.position.x);
    this.inputPosY.value = String(item.position.y);
    this.inputPosZ.value = String(item.position.z);

    this.inputRotY.value = String(item.rotation.y || 0);
    this.inputRotX.value = String(item.rotation.x || 0);
    this.inputRotZ.value = String(item.rotation.z || 0);

    this.inputColor.value = item.marker.color || '#00e5ff';
    this.inputSize.value = String(item.marker.size || 1.0);
    this.labelSizeVal.textContent = `${item.marker.size || 1.0}x`;
    this.chkShowBadge.checked = item.marker.showBadge !== false;

    this.chkVisible.checked = item.visible;
    this.chkLocked.checked = item.locked;

    // Preset color highlight
    document.querySelectorAll('.color-preset').forEach((btn) => {
      const color = (btn as HTMLElement).dataset.color;
      if (color?.toLowerCase() === item.marker.color?.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.txtSourceKind.textContent = item.source.kind;
    if (item.source.nodePath) {
      this.rowSourceNode.style.display = 'flex';
      this.txtSourceNode.textContent = item.source.nodePath;
    } else {
      this.rowSourceNode.style.display = 'none';
    }

    this.txtUpdatedAt.textContent = new Date(item.updatedAt).toLocaleTimeString();

    this.isInternalUpdate = false;
  }
}
