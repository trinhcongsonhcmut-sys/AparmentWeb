export const EditorEvents = {
  // Model events
  MODEL_LOADED: 'model:loaded',
  MODEL_UNLOADED: 'model:unloaded',
  MODEL_LOADING_PROGRESS: 'model:progress',
  MODEL_LOAD_ERROR: 'model:error',

  // Hotspot selection & state
  HOTSPOT_CREATED: 'hotspot:created',
  HOTSPOT_UPDATED: 'hotspot:updated',
  HOTSPOT_DELETED: 'hotspot:deleted',
  HOTSPOT_SELECTED: 'hotspot:selected',
  HOTSPOT_DESELECTED: 'hotspot:deselected',
  HOTSPOT_FOCUS_REQUESTED: 'hotspot:focus',
  HOTSPOTS_BATCH_CHANGED: 'hotspots:batch_changed',

  // Placement mode
  PLACEMENT_MODE_TOGGLED: 'placement:toggled',

  // Camera & Navigation
  NAV_MODE_CHANGED: 'nav:mode_changed',
  CAMERA_RESET: 'camera:reset',
  CAMERA_FOCUS_ALL: 'camera:focus_all',

  // Viewport Settings
  SETTING_CHANGED: 'settings:changed',

  // Storage & Config
  CONFIG_SAVED: 'config:saved',
  CONFIG_DIRTY_CHANGED: 'config:dirty_changed',

  // Toast
  SHOW_TOAST: 'toast:show'
} as const;

export type EventCallback = (data?: any) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    const subs = this.listeners.get(event);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, data?: any): void {
    const subs = this.listeners.get(event);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[EventBus] Error in listener for event "${event}":`, e);
        }
      });
    }
  }
}
