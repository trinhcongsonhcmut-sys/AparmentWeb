import {
  HotspotItem,
  HotspotFilterType,
  HotspotSortType,
} from '../types/hotspot.types';
import { EventBus, EditorEvents } from '../../../shared/events/EventBus';

export type StoreChangeListener = () => void;

export class HotspotStore {
  private items: Map<string, HotspotItem> = new Map();
  private selectedId: string | null = null;
  private multiSelectedIds: Set<string> = new Set();
  private isDirty: boolean = false;

  private filter: HotspotFilterType = 'all';
  private sort: HotspotSortType = 'index';
  private searchQuery: string = '';

  private listeners: Set<StoreChangeListener> = new Set();
  private eventBus: EventBus = EventBus.getInstance();

  constructor() {
    //
  }

  public getAll(): HotspotItem[] {
    return Array.from(this.items.values());
  }

  public getCount(): number {
    return this.items.size;
  }

  public getById(id: string): HotspotItem | undefined {
    return this.items.get(id);
  }

  public getSelectedId(): string | null {
    return this.selectedId;
  }

  public getSelectedItem(): HotspotItem | null {
    return this.selectedId ? this.items.get(this.selectedId) || null : null;
  }

  public getMultiSelectedIds(): string[] {
    return Array.from(this.multiSelectedIds);
  }

  public getFilteredAndSorted(): HotspotItem[] {
    let result = Array.from(this.items.values());

    // Search query
    if (this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) => h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)
      );
    }

    // Filter
    if (this.filter === 'visible') {
      result = result.filter((h) => h.visible);
    } else if (this.filter === 'hidden') {
      result = result.filter((h) => !h.visible);
    } else if (this.filter === 'imported') {
      result = result.filter((h) => h.source.kind === 'imported');
    } else if (this.filter === 'user') {
      result = result.filter((h) => h.source.kind !== 'imported');
    }

    // Sort
    if (this.sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sort === 'time') {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }

  public add(item: HotspotItem, markDirty: boolean = true): void {
    this.items.set(item.id, item);
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit(EditorEvents.HOTSPOT_CREATED, item);
  }

  public update(item: HotspotItem, markDirty: boolean = true): void {
    if (this.items.has(item.id)) {
      item.updatedAt = new Date().toISOString();
      this.items.set(item.id, item);
      if (markDirty) this.setDirty(true);
      this.notify();
      this.eventBus.emit(EditorEvents.HOTSPOT_UPDATED, item);
    }
  }

  public remove(id: string, markDirty: boolean = true): HotspotItem | null {
    const existing = this.items.get(id);
    if (existing) {
      this.items.delete(id);
      this.multiSelectedIds.delete(id);
      if (this.selectedId === id) {
        this.selectedId = null;
      }
      if (markDirty) this.setDirty(true);
      this.notify();
      this.eventBus.emit(EditorEvents.HOTSPOT_DELETED, existing);
      return existing;
    }
    return null;
  }

  public setAll(items: HotspotItem[], markDirty: boolean = false): void {
    this.items.clear();
    this.selectedId = null;
    this.multiSelectedIds.clear();
    for (const item of items) {
      this.items.set(item.id, item);
    }
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit(EditorEvents.HOTSPOTS_BATCH_CHANGED);
  }

  public clear(markDirty: boolean = true): void {
    this.items.clear();
    this.selectedId = null;
    this.multiSelectedIds.clear();
    if (markDirty) this.setDirty(true);
    this.notify();
    this.eventBus.emit(EditorEvents.HOTSPOTS_BATCH_CHANGED);
  }

  public select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.multiSelectedIds.clear();
    if (id) {
      this.multiSelectedIds.add(id);
    }
    this.notify();
    if (id) {
      const item = this.items.get(id);
      if (item) this.eventBus.emit(EditorEvents.HOTSPOT_SELECTED, item);
    } else {
      this.eventBus.emit(EditorEvents.HOTSPOT_DESELECTED);
    }
  }

  public toggleMultiSelect(id: string): void {
    if (this.multiSelectedIds.has(id)) {
      this.multiSelectedIds.delete(id);
      if (this.selectedId === id) {
        this.selectedId = this.multiSelectedIds.size > 0 ? Array.from(this.multiSelectedIds)[0] : null;
      }
    } else {
      this.multiSelectedIds.add(id);
      this.selectedId = id;
    }
    this.notify();
    if (this.selectedId) {
      this.eventBus.emit(EditorEvents.HOTSPOT_SELECTED, this.items.get(this.selectedId));
    }
  }

  public selectAll(): void {
    this.multiSelectedIds.clear();
    for (const id of this.items.keys()) {
      this.multiSelectedIds.add(id);
    }
    this.selectedId = this.items.size > 0 ? Array.from(this.items.keys())[0] : null;
    this.notify();
  }

  public deselectAll(): void {
    this.selectedId = null;
    this.multiSelectedIds.clear();
    this.notify();
    this.eventBus.emit(EditorEvents.HOTSPOT_DESELECTED);
  }

  public setFilter(filter: HotspotFilterType): void {
    this.filter = filter;
    this.notify();
  }

  public setSort(sort: HotspotSortType): void {
    this.sort = sort;
    this.notify();
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.notify();
  }

  public setDirty(dirty: boolean): void {
    if (this.isDirty !== dirty) {
      this.isDirty = dirty;
      this.eventBus.emit(EditorEvents.CONFIG_DIRTY_CHANGED, dirty);
    }
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public subscribe(listener: StoreChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
