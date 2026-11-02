import * as THREE from 'three';
import { WaypointGraphStore } from '../store/WaypointGraphStore';
import { HotspotStore } from '../../hotspots/store/HotspotStore';
import { GraphDiagnosticsService } from '../services/GraphDiagnosticsService';
import { CameraPathfindingService } from '../services/CameraPathfindingService';
import { GraphDiagnosticsReport } from '../types/waypointGraph.types';
import { HotspotItem } from '../../hotspots/types/hotspot.types';

export class GraphDiagnosticsModal {
  private store: WaypointGraphStore;
  private hotspotStore: HotspotStore;
  private diagnosticsService: GraphDiagnosticsService = GraphDiagnosticsService.getInstance();
  private pathfindingService: CameraPathfindingService = new CameraPathfindingService();

  private modal: HTMLElement;
  private btnClose: HTMLElement;
  private btnRunAudit: HTMLButtonElement;
  private contentContainer: HTMLElement;

  private selectTestStart: HTMLSelectElement;
  private selectTestDest: HTMLSelectElement;
  private btnRunTestRoute: HTMLButtonElement;
  private testResultBox: HTMLElement;

  private sceneRoot?: THREE.Object3D;
  private getCameraTransform?: () => { position: THREE.Vector3; quaternion: THREE.Quaternion };
  private onHighlightRoute?: (points: THREE.Vector3[]) => void;
  private onLocateWaypoint?: (wpId: string) => void;

  constructor(
    store: WaypointGraphStore,
    hotspotStore: HotspotStore,
    callbacks: {
      sceneRoot?: THREE.Object3D;
      getCameraTransform?: () => { position: THREE.Vector3; quaternion: THREE.Quaternion };
      onHighlightRoute?: (points: THREE.Vector3[]) => void;
      onLocateWaypoint?: (wpId: string) => void;
    } = {}
  ) {
    this.store = store;
    this.hotspotStore = hotspotStore;
    this.sceneRoot = callbacks.sceneRoot;
    this.getCameraTransform = callbacks.getCameraTransform;
    this.onHighlightRoute = callbacks.onHighlightRoute;
    this.onLocateWaypoint = callbacks.onLocateWaypoint;

    this.modal = document.getElementById('modal-graph-diagnostics')!;
    this.btnClose = document.getElementById('btn-close-diagnostics-modal')!;
    this.btnRunAudit = document.getElementById('btn-run-full-audit') as HTMLButtonElement;
    this.contentContainer = document.getElementById('diagnostics-modal-content')!;

    this.selectTestStart = document.getElementById('diag-test-start') as HTMLSelectElement;
    this.selectTestDest = document.getElementById('diag-test-dest') as HTMLSelectElement;
    this.btnRunTestRoute = document.getElementById('btn-run-test-route') as HTMLButtonElement;
    this.testResultBox = document.getElementById('diag-test-result')!;

    this.bindEvents();
  }

  public setSceneRoot(root: THREE.Object3D): void {
    this.sceneRoot = root;
  }

  private bindEvents(): void {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    if (this.btnRunAudit) {
      this.btnRunAudit.addEventListener('click', () => this.runAndRenderReport());
    }

    if (this.btnRunTestRoute) {
      this.btnRunTestRoute.addEventListener('click', () => this.handleTestRoute());
    }

    // Close on background backdrop click
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.hide();
      });
    }
  }

  public show(): void {
    if (!this.modal) return;
    this.modal.style.display = 'flex';
    this.populateTestOptions();
    this.runAndRenderReport();
  }

  public hide(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
  }

  private populateTestOptions(): void {
    if (!this.selectTestStart || !this.selectTestDest) return;

    // Start options
    this.selectTestStart.innerHTML = `<option value="camera_current">📍 Vị trí Camera hiện tại</option>`;
    for (const wp of this.store.getAllWaypoints()) {
      if (wp.status !== 'disabled') {
        const opt = document.createElement('option');
        opt.value = wp.id;
        opt.textContent = `Waypoint: ${wp.name}`;
        this.selectTestStart.appendChild(opt);
      }
    }

    // Destination options
    this.selectTestDest.innerHTML = `<option value="">(Chọn Hotspot đích)</option>`;
    for (const h of this.hotspotStore.getAll()) {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `Hotspot: ${h.name}`;
      this.selectTestDest.appendChild(opt);
    }
  }

  private runAndRenderReport(): void {
    if (!this.contentContainer) return;

    const waypoints = this.store.getAllWaypoints();
    const edges = this.store.getAllEdges();
    const hotspots = this.hotspotStore.getAll();

    const isLineSafeFn = this.sceneRoot
      ? (p1: THREE.Vector3, p2: THREE.Vector3) =>
        this.pathfindingService.isLineSafe(p1, p2, this.sceneRoot!, 0.25)
      : undefined;

    const report: GraphDiagnosticsReport = this.diagnosticsService.runDiagnostics(
      waypoints,
      edges,
      hotspots,
      undefined,
      undefined,
      isLineSafeFn
    );

    let healthBadge = `<span style="padding: 4px 10px; border-radius: 999px; background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 600; font-size: 12px; border: 1px solid rgba(16, 185, 129, 0.4);">✓ Mạng Liên Thông Khỏe Mạnh</span>`;
    if (!report.isHealthy) {
      healthBadge = `<span style="padding: 4px 10px; border-radius: 999px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 600; font-size: 12px; border: 1px solid rgba(245, 158, 11, 0.4);">⚠ Cần Xử Lý Một Số Cảnh Báo</span>`;
    }

    this.contentContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="font-size: 13px; color: var(--text-muted);">
          Kiểm tra lúc: <strong>${new Date(report.timestamp).toLocaleTimeString()}</strong>
        </div>
        ${healthBadge}
      </div>

      <!-- METRICS GRID -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #0ea5e9;">${report.totalWaypoints}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Tổng Waypoint</div>
        </div>
        <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #10b981;">${report.validEdges}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Cạnh An Toàn</div>
        </div>
        <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: ${report.isolatedWaypointIds.length > 0 ? '#f97316' : '#10b981'};">
            ${report.isolatedWaypointIds.length}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">Điểm Cô Lập</div>
        </div>
        <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: ${report.components.length > 1 ? '#f59e0b' : '#10b981'};">
            ${report.components.length}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">Số Phân Vùng Đảo</div>
        </div>
      </div>

      <!-- ISSUES SECTION -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${this.renderIsolatedSection(report.isolatedWaypointIds)}
        ${this.renderComponentsSection(report.components)}
        ${this.renderObstacleSection(report.obstacleIssues)}
        ${this.renderUnreachableHotspotsSection(report.unreachableHotspotIds)}
      </div>
    `;

    this.attachDiagnosticActions();
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  private renderIsolatedSection(isolatedIds: string[]): string {
    if (isolatedIds.length === 0) return '';
    const items = isolatedIds
      .map((id) => {
        const wp = this.store.getWaypoint(id);
        const name = wp ? wp.name : id;
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: rgba(249, 115, 22, 0.1); border-radius: 4px; margin-bottom: 4px;">
            <span style="font-size: 12px; color: #f97316; font-weight: 500;">📍 ${name}</span>
            <button class="btn-xs btn-locate-wp-diag" data-wpid="${id}" style="font-size: 11px;">Chọn điểm</button>
          </div>
        `;
      })
      .join('');

    return `
      <div style="border: 1px solid rgba(249, 115, 22, 0.3); background: rgba(249, 115, 22, 0.05); padding: 12px; border-radius: var(--radius-sm);">
        <div style="font-weight: 600; font-size: 13px; color: #f97316; margin-bottom: 8px;">
          ⚠ Phát hiện ${isolatedIds.length} Waypoint chưa có liên kết:
        </div>
        ${items}
      </div>
    `;
  }

  private renderComponentsSection(components: { componentIndex: number; waypointIds: string[] }[]): string {
    if (components.length <= 1) return '';
    const items = components
      .map((c) => {
        const names = c.waypointIds
          .map((id) => this.store.getWaypoint(id)?.name || id.slice(0, 6))
          .slice(0, 4)
          .join(', ');
        return `
          <div style="font-size: 12px; color: var(--text-main); margin-bottom: 4px;">
            • <strong>Nhóm đảo #${c.componentIndex}</strong> (${c.waypointIds.length} điểm): ${names}${c.waypointIds.length > 4 ? '...' : ''}
          </div>
        `;
      })
      .join('');

    return `
      <div style="border: 1px solid rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.05); padding: 12px; border-radius: var(--radius-sm);">
        <div style="font-weight: 600; font-size: 13px; color: #f59e0b; margin-bottom: 8px;">
          ⚠ Mạng Waypoint bị chia tách thành ${components.length} vùng độc lập không thông nhau:
        </div>
        ${items}
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
          Gợi ý: Thêm Waypoint kết nối giữa các phòng hoặc chạy tính năng "Tự động liên kết" với bán kính lớn hơn.
        </div>
      </div>
    `;
  }

  private renderObstacleSection(issues: { edgeId: string; reason: string }[]): string {
    if (issues.length === 0) return '';
    const items = issues
      .map((iss) => `
        <div style="font-size: 12px; color: #ef4444; margin-bottom: 4px;">
          • ${iss.reason}
        </div>
      `)
      .join('');

    return `
      <div style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: var(--radius-sm);">
        <div style="font-weight: 600; font-size: 13px; color: #ef4444; margin-bottom: 8px;">
          🚫 Phát hiện ${issues.length} Cạnh kết nối bị vật cản/tường chắn:
        </div>
        ${items}
      </div>
    `;
  }

  private renderUnreachableHotspotsSection(unreachableIds: string[]): string {
    if (unreachableIds.length === 0) return '';
    const items = unreachableIds
      .map((id) => {
        const h = this.hotspotStore.getById(id);
        return `• Hotspot "${h ? h.name : id}"`;
      })
      .join('<br>');

    return `
      <div style="border: 1px solid rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.05); padding: 12px; border-radius: var(--radius-sm);">
        <div style="font-weight: 600; font-size: 13px; color: #c4b5fd; margin-bottom: 8px;">
          ℹ Có ${unreachableIds.length} Hotspot chưa kết nối thông suốt với mạng Waypoint:
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">${items}</div>
      </div>
    `;
  }

  private attachDiagnosticActions(): void {
    if (!this.contentContainer) return;
    const locateBtns = this.contentContainer.querySelectorAll('.btn-locate-wp-diag');
    locateBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const wpId = (e.currentTarget as HTMLElement).getAttribute('data-wpid');
        if (wpId) {
          this.store.selectWaypoint(wpId);
          this.onLocateWaypoint?.(wpId);
          this.hide();
        }
      });
    });
  }

  private handleTestRoute(): void {
    if (!this.testResultBox || !this.sceneRoot) return;

    const startVal = this.selectTestStart.value;
    const destId = this.selectTestDest.value;

    if (!destId) {
      this.testResultBox.innerHTML = `<span style="color: #f59e0b;">Vui lòng chọn Hotspot đích.</span>`;
      return;
    }

    const destHotspot = this.hotspotStore.getById(destId);
    if (!destHotspot) return;

    let startPos = new THREE.Vector3();
    let startQuat = new THREE.Quaternion();

    if (startVal === 'camera_current') {
      if (this.getCameraTransform) {
        const t = this.getCameraTransform();
        startPos.copy(t.position);
        startQuat.copy(t.quaternion);
      }
    } else {
      const wp = this.store.getWaypoint(startVal);
      if (wp) {
        startPos.set(wp.position.x, wp.position.y, wp.position.z);
      }
    }

    const waypoints = this.store.getAllWaypoints();
    const edges = this.store.getAllEdges();
    const hotspots = this.hotspotStore.getAll();

    const result = this.pathfindingService.findOptimalRoute(
      startPos,
      startQuat,
      destHotspot,
      hotspots,
      waypoints,
      [],
      this.sceneRoot,
      edges
    );

    if (result.success && result.controlPoints) {
      this.testResultBox.innerHTML = `
        <div style="padding: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); color: #10b981; font-size: 12px;">
          <strong>✓ Tìm đường thành công!</strong><br>
          • Chế độ: <strong>${result.mode === 'direct' ? 'Đường thẳng an toàn' : 'Đi qua mạng Waypoint'}</strong><br>
          • Thời gian dự kiến: <strong>${(result.durationSeconds || 0).toFixed(1)}s</strong><br>
          • Số chặng kiểm soát: <strong>${result.controlPoints.length} điểm</strong><br>
          • Tuyến đường màu vàng kim đã được vẽ nổi bật trên 3D Viewport.
          <button id="btn-diag-view-3d-route" class="btn btn-xs btn-primary" style="margin-top: 8px; width: 100%; justify-content: center; display: flex; align-items: center; gap: 4px;">
            👁️ Đóng bảng & Quan sát tuyến trên 3D
          </button>
        </div>
      `;
      this.onHighlightRoute?.(result.controlPoints);

      const btnView3D = document.getElementById('btn-diag-view-3d-route');
      if (btnView3D) {
        btnView3D.addEventListener('click', () => {
          this.hide();
        });
      }
    } else {
      this.testResultBox.innerHTML = `
        <div style="padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-sm); color: #ef4444; font-size: 12px;">
          <strong>✕ Không tìm được đường:</strong><br>
          ${result.message || 'Bị chặn bởi vật cản hoặc không có cạnh liên kết an toàn.'}
        </div>
      `;
    }
  }
}

