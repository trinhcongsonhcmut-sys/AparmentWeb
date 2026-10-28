import { CandidateHotspot, HotspotItem } from '../types/hotspot.types';
import { HotspotStore } from '../store/HotspotStore';
import { AddHotspotCommand } from '../commands/AddHotspotCommand';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { MathUtils } from '../../../shared/math/MathUtils';

export class CandidateModal {
  private modalElement: HTMLElement;
  private tableBody: HTMLElement;
  private selectAllCheckbox: HTMLInputElement;
  private selectedCountSpan: HTMLElement;
  private btnImport: HTMLButtonElement;
  private btnSkip: HTMLButtonElement;
  private btnClose: HTMLElement;

  private store: HotspotStore;
  private history: CommandHistory;
  private candidates: CandidateHotspot[] = [];

  constructor(store: HotspotStore, history: CommandHistory) {
    this.store = store;
    this.history = history;

    this.modalElement = document.getElementById('modal-candidates')!;
    this.tableBody = document.getElementById('candidates-table-body')!;
    this.selectAllCheckbox = document.getElementById('select-all-candidates') as HTMLInputElement;
    this.selectedCountSpan = document.getElementById('candidate-selected-count')!;
    this.btnImport = document.getElementById('btn-import-candidates') as HTMLButtonElement;
    this.btnSkip = document.getElementById('btn-skip-candidates') as HTMLButtonElement;
    this.btnClose = document.getElementById('btn-close-candidate-modal')!;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.selectAllCheckbox.addEventListener('change', () => {
      const checked = this.selectAllCheckbox.checked;
      this.candidates.forEach((c) => (c.selected = checked));
      this.renderRows();
      this.updateCount();
    });

    this.btnClose.addEventListener('click', () => this.hide());
    this.btnSkip.addEventListener('click', () => this.hide());

    this.btnImport.addEventListener('click', () => {
      const selected = this.candidates.filter((c) => c.selected);
      if (selected.length === 0) {
        this.hide();
        return;
      }

      for (const cand of selected) {
        const item: HotspotItem = {
          id: cand.id,
          name: cand.name,
          type: 'navigation',
          position: cand.position,
          rotation: { x: 0, y: 0, z: 0 },
          visible: true,
          locked: false,
          marker: {
            color: '#10B981', // Emerald for imported nodes
            size: 1.0,
            showBadge: true,
          },
          source: {
            kind: 'imported',
            nodePath: cand.nodePath,
            originalName: cand.name,
            detectedType: cand.nodeType,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.history.execute(new AddHotspotCommand(this.store, item));
      }

      this.hide();
    });
  }

  public show(candidates: CandidateHotspot[]): void {
    this.candidates = candidates;
    this.selectAllCheckbox.checked = true;
    this.renderRows();
    this.updateCount();
    this.modalElement.style.display = 'flex';
  }

  public hide(): void {
    this.modalElement.style.display = 'none';
  }

  private renderRows(): void {
    this.tableBody.innerHTML = '';

    this.candidates.forEach((cand, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="cand-chk" data-idx="${idx}" ${cand.selected ? 'checked' : ''} /></td>
        <td>
          <input type="text" class="input-text cand-name-input" data-idx="${idx}" value="${cand.name}" style="padding: 2px 6px; font-size: 11px;" />
        </td>
        <td class="monospace" style="color: var(--text-dim); font-size: 11px;">${cand.nodePath}</td>
        <td><span class="sample-badge">${cand.nodeType}</span></td>
        <td class="monospace" style="font-size: 11px;">X:${cand.position.x} Y:${cand.position.y} Z:${cand.position.z}</td>
      `;

      const chk = tr.querySelector('.cand-chk') as HTMLInputElement;
      chk?.addEventListener('change', () => {
        cand.selected = chk.checked;
        this.updateCount();
      });

      const nameInput = tr.querySelector('.cand-name-input') as HTMLInputElement;
      nameInput?.addEventListener('input', () => {
        cand.name = nameInput.value.trim() || 'Điểm chưa đặt tên';
      });

      this.tableBody.appendChild(tr);
    });
  }

  private updateCount(): void {
    const selectedCount = this.candidates.filter((c) => c.selected).length;
    this.selectedCountSpan.textContent = String(selectedCount);
    this.btnImport.disabled = selectedCount === 0;
  }
}
