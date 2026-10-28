import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { HotspotItem } from '../types/hotspot.types';

export class HotspotMarker2D {
  public readonly hotspot: HotspotItem;
  public readonly anchor: THREE.Object3D;
  public readonly css2dObject: CSS2DObject;
  public readonly element: HTMLElement;

  private pinElement!: HTMLElement;
  private innerBadge!: HTMLElement;
  private tooltipElement!: HTMLElement;
  private lockIconElement!: HTMLElement;

  private onSelectCallback?: (item: HotspotItem) => void;

  constructor(hotspot: HotspotItem, onSelect?: (item: HotspotItem) => void) {
    this.hotspot = hotspot;
    this.onSelectCallback = onSelect;

    this.element = this.createDomElement();
    this.css2dObject = new CSS2DObject(this.element);

    this.anchor = new THREE.Object3D();
    this.anchor.name = `HotspotAnchor_${hotspot.id}`;
    this.anchor.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z);
    this.anchor.add(this.css2dObject);

    // Apply initial state
    this.updateFromItem(hotspot, 1);
  }

  private createDomElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'css2d-marker-container';
    container.dataset.hotspotId = this.hotspot.id;

    // Pin shape
    this.pinElement = document.createElement('div');
    this.pinElement.className = 'marker-pin';

    this.innerBadge = document.createElement('span');
    this.innerBadge.className = 'marker-inner';
    this.pinElement.appendChild(this.innerBadge);

    // Lock indicator
    this.lockIconElement = document.createElement('div');
    this.lockIconElement.className = 'marker-lock-icon';
    this.lockIconElement.innerHTML = '🔒';
    this.lockIconElement.style.display = 'none';
    this.pinElement.appendChild(this.lockIconElement);

    // Pulse ring
    const ring = document.createElement('div');
    ring.className = 'marker-pulse-ring';

    // Tooltip label
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'marker-tooltip';

    container.appendChild(this.tooltipElement);
    container.appendChild(this.pinElement);
    container.appendChild(ring);

    // Click handler
    container.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectCallback?.(this.hotspot);
    });

    return container;
  }

  public updateFromItem(item: HotspotItem, index: number): void {
    // Position
    this.anchor.position.set(item.position.x, item.position.y, item.position.z);

    // Name & Tooltip
    this.tooltipElement.textContent = item.name;

    // Index Badge
    this.innerBadge.textContent = item.marker.showBadge ? String(index) : '📍';

    // Color & Size
    const color = item.marker.color || '#00e5ff';
    const scale = item.marker.size || 1.0;
    this.pinElement.style.background = color;
    this.pinElement.style.width = `${Math.round(28 * scale)}px`;
    this.pinElement.style.height = `${Math.round(28 * scale)}px`;

    // Locked indicator
    this.lockIconElement.style.display = item.locked ? 'flex' : 'none';

    // Visibility
    this.anchor.visible = item.visible;
  }

  public setSelected(selected: boolean): void {
    if (selected) {
      this.element.classList.add('selected');
      this.pinElement.classList.add('selected');
    } else {
      this.element.classList.remove('selected');
      this.pinElement.classList.remove('selected');
    }
  }

  public setXRay(enabled: boolean): void {
    if (enabled) {
      this.element.classList.add('xray-enabled');
    } else {
      this.element.classList.remove('xray-enabled');
    }
  }

  public dispose(): void {
    if (this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.anchor.clear();
  }
}
