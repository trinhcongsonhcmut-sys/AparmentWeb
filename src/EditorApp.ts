import * as THREE from 'three';
import { SceneManager } from './core/engine/SceneManager';
import { NavigationController } from './core/navigation/NavigationController';
import { ModelLoaderService, LoadedModelResult } from './core/loaders/ModelLoaderService';
import { SurfacePicker } from './core/raycasting/SurfacePicker';
import { TransformGizmoManager } from './core/gizmo/TransformGizmoManager';
import { CandidateDetector } from './modules/hotspots/detector/CandidateDetector';
import { HotspotStore } from './modules/hotspots/store/HotspotStore';
import { HotspotMarker2D } from './modules/hotspots/components/HotspotMarker2D';
import { CommandHistory } from './shared/history/CommandHistory';
import { AddHotspotCommand } from './modules/hotspots/commands/AddHotspotCommand';
import { DeleteHotspotCommand } from './modules/hotspots/commands/DeleteHotspotCommand';
import { MoveHotspotCommand } from './modules/hotspots/commands/MoveHotspotCommand';
import { HotspotListPanel } from './modules/hotspots/ui/HotspotListPanel';
import { PropertyPanel } from './modules/hotspots/ui/PropertyPanel';
import { CandidateModal } from './modules/hotspots/ui/CandidateModal';
import { ConfirmModal } from './shared/ui/ConfirmModal';
import { ToastNotification } from './shared/ui/ToastNotification';
import { ConfigStorageService } from './modules/config/services/ConfigStorageService';
import { SampleModelsCatalog } from './services/SampleModelsCatalog';
import { EventBus, EditorEvents } from './shared/events/EventBus';
import { HotspotItem } from './modules/hotspots/types/hotspot.types';
import { ModelInfoMeta } from './modules/config/types/config.types';
import { MathUtils } from './shared/math/MathUtils';

// CAMERA PATH IMPORTS
import { CameraPathStore } from './modules/camera-path/store/CameraPathStore';
import { CameraPath, CameraWaypoint } from './modules/camera-path/types/cameraPath.types';
import { PathTrajectoryEvaluator } from './modules/camera-path/services/PathTrajectoryEvaluator';
import { PathCollisionChecker } from './modules/camera-path/services/PathCollisionChecker';
import { PathPlaybackController } from './modules/camera-path/services/PathPlaybackController';
import { Path3DVisualizer } from './modules/camera-path/components/Path3DVisualizer';
import { PathListPanel } from './modules/camera-path/ui/PathListPanel';
import { PathPropertyPanel } from './modules/camera-path/ui/PathPropertyPanel';
import { PlaybackTimelineHUD } from './modules/camera-path/ui/PlaybackTimelineHUD';
import { AddWaypointCommand } from './modules/camera-path/commands/AddWaypointCommand';
import { MoveWaypointCommand } from './modules/camera-path/commands/MoveWaypointCommand';
import { CreatePathCommand } from './modules/camera-path/commands/CreatePathCommand';
import { UpdatePathCommand } from './modules/camera-path/commands/UpdatePathCommand';
import { PathTerminalOrientation } from './modules/camera-path/types/cameraPath.types';

export type EditorMode = 'hotspots' | 'paths';

export class EditorApp {
  private sceneManager!: SceneManager;
  private navController!: NavigationController;
  private loaderService!: ModelLoaderService;
  private surfacePicker!: SurfacePicker;
  private gizmoManager!: TransformGizmoManager;

  // Stores & History
  private store: HotspotStore = new HotspotStore();
  private pathStore: CameraPathStore = new CameraPathStore();
  private history: CommandHistory = new CommandHistory();
  private eventBus: EventBus = EventBus.getInstance();

  // Hotspot UI Panels
  private listPanel!: HotspotListPanel;
  private propertyPanel!: PropertyPanel;
  private candidateModal!: CandidateModal;
  private confirmModal!: ConfirmModal;
  private toastNotification!: ToastNotification;

  // Camera Path Subsystems
  private trajectoryEvaluator: PathTrajectoryEvaluator = new PathTrajectoryEvaluator();
  private collisionChecker: PathCollisionChecker = new PathCollisionChecker();
  private playbackController!: PathPlaybackController;
  private pathVisualizer!: Path3DVisualizer;
  private pathListPanel!: PathListPanel;
  private pathPropertyPanel!: PathPropertyPanel;
  private timelineHUD!: PlaybackTimelineHUD;

  // Active Editor Mode
  private activeMode: EditorMode = 'hotspots';

  private activeMarkers: Map<string, HotspotMarker2D> = new Map();
  private currentModelMeta: ModelInfoMeta | null = null;

  // Placement mode
  private isPlacingHotspot: boolean = false;
  private isPlacingWaypoint: boolean = false;
  private placementHud!: HTMLElement;

  // End Orientation & Transform Alignment
  private isAligningEndOrientation: boolean = false;
  private endOrientHud!: HTMLElement;
  private endOrientCameraSnapshot: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    target: THREE.Vector3;
  } | null = null;

  // Settings
  private isXRayEnabled: boolean = false;
  private isGridEnabled: boolean = true;
  private isMarkersVisible: boolean = true;

  constructor() {
    //
  }

  public async init(): Promise<void> {
    const canvasContainer = document.getElementById('canvas-3d-wrapper')!;
    const css2dContainer = document.getElementById('css2d-wrapper')!;

    // 1. Initialize Scene & Navigation
    this.sceneManager = new SceneManager({ canvasContainer, css2dContainer });
    this.navController = new NavigationController(this.sceneManager.camera, canvasContainer);
    this.loaderService = new ModelLoaderService();
    this.surfacePicker = new SurfacePicker();

    // 2. Playback Controller
    this.playbackController = new PathPlaybackController(
      this.sceneManager.camera,
      (target) => this.navController.orbitControls.target.copy(target),
      (enabled) => {
        this.navController.orbitControls.enabled = enabled;
      }
    );

    // 3. Initialize Gizmo Manager
    this.gizmoManager = new TransformGizmoManager(
      this.sceneManager.camera,
      canvasContainer,
      this.sceneManager.scene,
      this.navController.orbitControls,
      {
        onDragStart: () => {
          //
        },
        onDrag: (pos, rot) => {
          if (this.activeMode === 'hotspots') {
            const item = this.store.getSelectedItem();
            if (item) {
              item.position = { x: MathUtils.round(pos.x, 2), y: MathUtils.round(pos.y, 2), z: MathUtils.round(pos.z, 2) };
              item.rotation = {
                x: Math.round(THREE.MathUtils.radToDeg(rot.x)),
                y: Math.round(THREE.MathUtils.radToDeg(rot.y)),
                z: Math.round(THREE.MathUtils.radToDeg(rot.z)),
              };
              this.propertyPanel.updateCoordsFromGizmo(item.position, item.rotation);
            }
          } else if (this.activeMode === 'paths') {
            const wp = this.pathStore.getSelectedWaypoint();
            if (wp) {
              wp.position = { x: MathUtils.round(pos.x, 2), y: MathUtils.round(pos.y, 2), z: MathUtils.round(pos.z, 2) };
              this.pathPropertyPanel.updateWaypointCoords(wp.position);
              this.syncActivePathVisuals();
            }
          }
        },
        onDragEnd: (prevPos, prevRot, newPos, newRot) => {
          if (this.activeMode === 'hotspots') {
            const item = this.store.getSelectedItem();
            if (item) {
              const oldP = MathUtils.roundVector(prevPos, 2);
              const newP = MathUtils.roundVector(newPos, 2);
              const oldR = {
                x: Math.round(THREE.MathUtils.radToDeg(prevRot.x)),
                y: Math.round(THREE.MathUtils.radToDeg(prevRot.y)),
                z: Math.round(THREE.MathUtils.radToDeg(prevRot.z)),
              };
              const newR = {
                x: Math.round(THREE.MathUtils.radToDeg(newRot.x)),
                y: Math.round(THREE.MathUtils.radToDeg(newRot.y)),
                z: Math.round(THREE.MathUtils.radToDeg(newRot.z)),
              };
              this.history.execute(new MoveHotspotCommand(this.store, item.id, oldP, newP, oldR, newR));
            }
          } else if (this.activeMode === 'paths') {
            const wp = this.pathStore.getSelectedWaypoint();
            if (wp) {
              const oldP = MathUtils.roundVector(prevPos, 2);
              const newP = MathUtils.roundVector(newPos, 2);
              this.history.execute(new MoveWaypointCommand(this.pathStore, wp.id, oldP, newP, wp.orientation, wp.orientation));
            }
          }
        },
      }
    );

    // 4. Visualizers & 3D Helpers
    this.pathVisualizer = new Path3DVisualizer(this.sceneManager.scene, (wpId) => {
      this.pathStore.selectWaypoint(wpId);
    });

    // Add SceneManager update callback
    this.sceneManager.addUpdateCallback((delta) => {
      this.navController.update(delta);
      this.playbackController.update(delta);
    });

    // 5. UI Helpers & Panels
    this.confirmModal = new ConfirmModal();
    this.toastNotification = new ToastNotification();
    this.candidateModal = new CandidateModal(this.store, this.history);

    this.listPanel = new HotspotListPanel(this.store, this.history, (items) => {
      this.promptDeleteHotspots(items);
    });

    this.propertyPanel = new PropertyPanel(this.store, this.history, (item) => {
      this.promptDeleteHotspots([item]);
    });

    // Camera Path Panels
    this.pathListPanel = new PathListPanel(
      this.pathStore,
      this.store,
      this.history,
      () => this.setWaypointPlacementMode(true),
      () => this.openCreatePathModal()
    );

    this.pathPropertyPanel = new PathPropertyPanel(
      this.pathStore,
      this.store,
      this.history,
      () => this.startAligningEndOrientation()
    );
    this.pathPropertyPanel.setOnGetCurrentCameraTransform(() => this.getCurrentCameraTransform());

    this.sceneManager.addUpdateCallback(() => {
      if (this.isAligningEndOrientation) {
        this.updateAligningHudDisplays();
      }
    });

    this.timelineHUD = new PlaybackTimelineHUD(this.playbackController);

    this.placementHud = document.getElementById('placement-hud')!;
    this.endOrientHud = document.getElementById('end-orientation-hud')!;
    this.bindEndOrientationHudEvents();

    // 6. Bind Global Events
    this.bindGlobalEvents();
    this.bindModeSwitcherEvents();
    this.bindViewportInteractions();
    this.bindTopNavEvents();
    this.bindModelImportEvents();
    this.bindPathEvents();

    // 7. Auto-load sample apartment on start
    await this.loadSampleModel('modern_apartment');
  }

  private bindModeSwitcherEvents(): void {
    const tabHotspots = document.getElementById('tab-mode-hotspots')!;
    const tabPaths = document.getElementById('tab-mode-paths')!;

    const panelHotspotsLeft = document.getElementById('panel-hotspots-content')!;
    const panelPathsLeft = document.getElementById('panel-camera-paths')!;
    const panelHotspotsRight = document.getElementById('inspector-content')!;
    const panelPathsRight = document.getElementById('panel-path-inspector')!;

    const topbarHotspotActions = document.getElementById('topbar-hotspot-actions')!;
    const topbarPathActions = document.getElementById('topbar-path-actions')!;

    const btnCreatePathTopbar = document.getElementById('btn-create-path-topbar')!;
    const btnAddWaypointTopbar = document.getElementById('btn-add-waypoint-topbar')!;
    const btnPreviewPathTopbar = document.getElementById('btn-preview-path-topbar')!;

    tabHotspots.addEventListener('click', () => {
      if (this.activeMode === 'hotspots') return;
      this.activeMode = 'hotspots';

      tabHotspots.classList.add('active');
      tabPaths.classList.remove('active');

      panelHotspotsLeft.style.display = 'flex';
      panelPathsLeft.style.display = 'none';
      panelHotspotsRight.style.display = 'block';
      panelPathsRight.style.display = 'none';

      topbarHotspotActions.style.display = 'flex';
      topbarPathActions.style.display = 'none';

      if (this.isAligningEndOrientation) this.cancelAligningEndOrientation();
      this.timelineHUD.setVisible(false);
      this.gizmoManager.detach();

      this.toastNotification.show('Chế độ: Quản lý Hotspot', 'info');
    });

    tabPaths.addEventListener('click', () => {
      if (this.activeMode === 'paths') return;
      this.activeMode = 'paths';

      tabPaths.classList.add('active');
      tabHotspots.classList.remove('active');

      panelHotspotsLeft.style.display = 'none';
      panelPathsLeft.style.display = 'flex';
      panelHotspotsRight.style.display = 'none';
      panelPathsRight.style.display = 'flex';

      topbarHotspotActions.style.display = 'none';
      topbarPathActions.style.display = 'flex';

      this.store.select(null);
      this.gizmoManager.detach();

      this.pathListPanel.render();
      this.pathPropertyPanel.updateFromStore();
      this.syncActivePathVisuals();

      if ((window as any).lucide) (window as any).lucide.createIcons();
      this.toastNotification.show('Chế độ: Thiết kế Tuyến Camera (Path Editor)', 'info');
    });

    btnCreatePathTopbar.addEventListener('click', () => {
      this.openCreatePathModal();
    });

    btnAddWaypointTopbar.addEventListener('click', () => {
      this.setWaypointPlacementMode(!this.isPlacingWaypoint);
    });

    btnPreviewPathTopbar.addEventListener('click', () => {
      this.toggleTimelinePreview();
    });

    const btnSetEndOrientTopbar = document.getElementById('btn-set-end-orient-topbar');
    if (btnSetEndOrientTopbar) {
      btnSetEndOrientTopbar.addEventListener('click', () => {
        this.startAligningEndOrientation();
      });
    }
  }

  private toggleTimelinePreview(): void {
    const activePath = this.pathStore.getActivePath();
    if (!activePath) {
      this.toastNotification.show('Chưa có tuyến camera nào để xem trước. Vui lòng tạo tuyến trước!', 'warning');
      this.openCreatePathModal();
      return;
    }

    const state = this.playbackController.getState();
    if (state === 'playing') {
      this.playbackController.pause();
    } else if (state === 'paused') {
      this.playbackController.resume();
    } else {
      this.timelineHUD.setVisible(true);
      this.playbackController.play(activePath, this.trajectoryEvaluator);
    }
  }

  private bindPathEvents(): void {
    // When active path changes, update 3D curve & visualizer
    this.eventBus.on('path:active_changed', () => {
      this.syncActivePathVisuals();
      this.pathPropertyPanel.updateFromStore();
    });

    this.eventBus.on('path:updated', () => {
      this.syncActivePathVisuals();
    });

    this.eventBus.on('path:created', () => {
      this.syncActivePathVisuals();
    });

    this.eventBus.on('path:deleted', () => {
      this.syncActivePathVisuals();
    });

    // When waypoint is selected, attach 3D Gizmo to its anchor
    this.eventBus.on('waypoint:selected', (wp: CameraWaypoint) => {
      if (this.activeMode === 'paths') {
        const anchor = this.pathVisualizer.getAnchor(wp.id);
        if (anchor && !wp.locked) {
          this.gizmoManager.attach(anchor);
          document.getElementById('gizmo-mode-toolbar')!.style.display = 'flex';
        } else {
          this.gizmoManager.detach();
        }
        this.pathPropertyPanel.updateFromStore();
      }
    });

    this.eventBus.on('waypoint:deselected', () => {
      if (this.activeMode === 'paths') {
        this.gizmoManager.detach();
        document.getElementById('gizmo-mode-toolbar')!.style.display = 'none';
        this.pathPropertyPanel.updateFromStore();
      }
    });

    this.eventBus.on('waypoint:created', () => {
      this.syncActivePathVisuals();
      this.pathListPanel.render();
    });

    this.eventBus.on('waypoint:updated', () => {
      this.syncActivePathVisuals();
      this.pathListPanel.render();
    });

    this.eventBus.on('waypoint:deleted', () => {
      this.syncActivePathVisuals();
      this.pathListPanel.render();
    });

    // Create Path Modal
    this.bindCreatePathModal();
  }

  private syncActivePathVisuals(): void {
    const activePath = this.pathStore.getActivePath();
    if (!activePath) {
      this.pathVisualizer.clearVisuals();
      this.timelineHUD.setPathAndEvaluator(null, null);
      return;
    }

    const fromHotspot = this.store.getById(activePath.fromHotspotId);
    const toHotspot = this.store.getById(activePath.toHotspotId);
    const waypoints = this.pathStore.getWaypointsForPath(activePath.id);
    const selectedWpId = this.pathStore.getSelectedWaypointId();

    this.trajectoryEvaluator.buildTrajectory(activePath, waypoints, fromHotspot, toHotspot);

    // Run collision check
    const warnings = this.collisionChecker.checkPath(
      activePath,
      this.trajectoryEvaluator,
      this.sceneManager.currentModelGroup
    );
    activePath.warnings = warnings;

    this.pathVisualizer.updateVisuals(
      activePath,
      this.trajectoryEvaluator,
      waypoints,
      selectedWpId,
      fromHotspot,
      toHotspot
    );

    // Update timeline HUD
    this.timelineHUD.setPathAndEvaluator(activePath, this.trajectoryEvaluator);
  }

  private bindCreatePathModal(): void {
    const modal = document.getElementById('modal-create-path')!;
    const btnClose = document.getElementById('btn-close-create-path-modal')!;
    const btnCancel = document.getElementById('btn-cancel-create-path')!;
    const btnSubmit = document.getElementById('btn-submit-create-path')!;

    const inputName = document.getElementById('new-path-name') as HTMLInputElement;
    const selectFrom = document.getElementById('new-path-from') as HTMLSelectElement;
    const selectTo = document.getElementById('new-path-to') as HTMLSelectElement;
    const selectCurve = document.getElementById('new-path-curve') as HTMLSelectElement;
    const inputDuration = document.getElementById('new-path-duration') as HTMLInputElement;

    const closeModal = () => {
      modal.style.display = 'none';
    };

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    btnSubmit.addEventListener('click', () => {
      const fromId = selectFrom.value;
      const toId = selectTo.value;

      if (!fromId || !toId) {
        alert('Vui lòng chọn cả điểm xuất phát và điểm đến!');
        return;
      }
      if (fromId === toId) {
        alert('Điểm xuất phát và điểm đến không được trùng nhau!');
        return;
      }

      const name = inputName.value.trim() || 'Tuyến mới';
      const curve = (selectCurve.value as any) || 'spline';
      const dur = parseFloat(inputDuration.value) || 8.0;

      const newPath: CameraPath = {
        id: MathUtils.generateUUID(),
        name,
        fromHotspotId: fromId,
        toHotspotId: toId,
        waypointIds: [],
        curveType: curve,
        tension: 0.5,
        durationSeconds: dur,
        easing: 'easeInOut',
        bidirectional: false,
        enabled: true,
        warnings: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.history.execute(new CreatePathCommand(this.pathStore, newPath));
      closeModal();
      if (this.activeMode !== 'paths') {
        const tabPaths = document.getElementById('tab-mode-paths');
        tabPaths?.click();
      }
      this.toastNotification.show(`Đã tạo tuyến "${newPath.name}" thành công!`, 'success');
    });
  }

  private openCreatePathModal(): void {
    const modal = document.getElementById('modal-create-path')!;
    const selectFrom = document.getElementById('new-path-from') as HTMLSelectElement;
    const selectTo = document.getElementById('new-path-to') as HTMLSelectElement;
    const inputName = document.getElementById('new-path-name') as HTMLInputElement;

    const hotspots = this.store.getAll();
    if (hotspots.length < 2) {
      this.toastNotification.show(
        'Cần có ít nhất 2 Hotspot trên mô hình để tạo tuyến camera kết nối. Vui lòng thêm Hotspot hoặc nạp các điểm gợi ý trước!',
        'warning',
        5000
      );
      return;
    }

    selectFrom.innerHTML = '';
    selectTo.innerHTML = '';
    hotspots.forEach((h, idx) => {
      const optFrom = document.createElement('option');
      optFrom.value = h.id;
      optFrom.textContent = h.name;
      selectFrom.appendChild(optFrom);

      const optTo = document.createElement('option');
      optTo.value = h.id;
      optTo.textContent = h.name;
      if (idx === 1) optTo.selected = true;
      selectTo.appendChild(optTo);
    });

    inputName.value = `Tuyến ${hotspots[0].name} -> ${hotspots[1]?.name || 'Điểm 2'}`;
    modal.style.display = 'flex';
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  private setWaypointPlacementMode(active: boolean): void {
    if (active) {
      const activePath = this.pathStore.getActivePath();
      if (!activePath) {
        this.toastNotification.show('Vui lòng tạo hoặc chọn một Tuyến camera trước khi thêm Waypoint!', 'warning');
        this.openCreatePathModal();
        return;
      }
    }

    this.isPlacingWaypoint = active;
    const btn = document.getElementById('btn-add-waypoint-topbar')!;
    if (active) {
      btn.classList.add('btn-active');
      btn.style.background = 'var(--accent-purple)';
      btn.style.color = '#ffffff';
      this.placementHud.style.display = 'flex';
      this.placementHud.querySelector('span')!.textContent = 'Chế độ đặt Waypoint: Nhấp vào vị trí trên mô hình 3D';
      document.body.style.cursor = 'crosshair';
      this.toastNotification.show('Nhấp lên bề mặt sàn hoặc phòng để thêm điểm Waypoint trung gian', 'info');
    } else {
      btn.classList.remove('btn-active');
      btn.style.background = '';
      btn.style.color = '#c4b5fd';
      this.placementHud.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  }

  private bindGlobalEvents(): void {
    // Event: Hotspot Selected
    this.eventBus.on(EditorEvents.HOTSPOT_SELECTED, (item: HotspotItem) => {
      if (this.activeMode === 'hotspots') {
        this.updateSelectionVisuals(item.id);
        const marker = this.activeMarkers.get(item.id);
        if (marker && !item.locked) {
          this.gizmoManager.attach(marker.anchor);
          document.getElementById('gizmo-mode-toolbar')!.style.display = 'flex';
        } else {
          this.gizmoManager.detach();
          document.getElementById('gizmo-mode-toolbar')!.style.display = 'none';
        }
      }
    });

    // Event: Hotspot Deselected
    this.eventBus.on(EditorEvents.HOTSPOT_DESELECTED, () => {
      if (this.activeMode === 'hotspots') {
        this.updateSelectionVisuals(null);
        this.gizmoManager.detach();
        document.getElementById('gizmo-mode-toolbar')!.style.display = 'none';
      }
    });

    // Event: Hotspot Focus
    this.eventBus.on(EditorEvents.HOTSPOT_FOCUS_REQUESTED, (item: HotspotItem) => {
      this.navController.focusHotspot(new THREE.Vector3(item.position.x, item.position.y, item.position.z));
    });

    // Event: Hotspot Created/Updated/Deleted -> Sync 3D Markers & Path endpoints
    this.eventBus.on(EditorEvents.HOTSPOT_CREATED, (item: HotspotItem) => {
      this.createOrUpdateMarker(item);
      this.syncActivePathVisuals();
    });
    this.eventBus.on(EditorEvents.HOTSPOT_UPDATED, (item: HotspotItem) => {
      this.createOrUpdateMarker(item);
      this.syncActivePathVisuals();
    });
    this.eventBus.on(EditorEvents.HOTSPOT_DELETED, (item: HotspotItem) => {
      this.removeMarker(item.id);
      this.syncActivePathVisuals();
    });
    this.eventBus.on(EditorEvents.HOTSPOTS_BATCH_CHANGED, () => {
      this.rebuildAllMarkers();
      this.syncActivePathVisuals();
    });

    // Event: Show Toast
    this.eventBus.on(EditorEvents.SHOW_TOAST, (data: any) => {
      this.toastNotification.show(data.message, data.type || 'info');
    });

    // Event: Dirty state changed
    this.eventBus.on(EditorEvents.CONFIG_DIRTY_CHANGED, (dirty: boolean) => {
      const badge = document.getElementById('save-status-badge')!;
      const text = document.getElementById('save-status-text')!;
      if (dirty || this.pathStore.getIsDirty()) {
        badge.className = 'save-status-badge dirty';
        text.textContent = 'Chưa lưu';
      } else {
        badge.className = 'save-status-badge saved';
        text.textContent = 'Đã lưu';
      }
    });

    // History undo/redo state update
    const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
    const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
    this.history.subscribe((canUndo, canRedo) => {
      btnUndo.disabled = !canUndo;
      btnRedo.disabled = !canRedo;
    });

    btnUndo.addEventListener('click', () => this.history.undo());
    btnRedo.addEventListener('click', () => this.history.redo());

    // Window beforeunload alert if dirty
    window.addEventListener('beforeunload', (e) => {
      if (this.store.getIsDirty() || this.pathStore.getIsDirty()) {
        e.preventDefault();
        e.returnValue = 'Bạn có thay đổi chưa lưu trên mô hình 3D. Bạn có chắc chắn muốn rời khỏi trang?';
      }
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        this.history.undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ')
      ) {
        e.preventDefault();
        this.history.redo();
      }
      // Gizmo Translate: W
      else if (e.code === 'KeyW' && this.navController.getMode() !== 'walk') {
        this.setGizmoMode('translate');
      }
      // Gizmo Rotate: E
      else if (e.code === 'KeyE' && this.navController.getMode() !== 'walk') {
        this.setGizmoMode('rotate');
      }
      // Focus: F
      else if (e.code === 'KeyF') {
        if (this.activeMode === 'hotspots') {
          const selected = this.store.getSelectedItem();
          if (selected) {
            this.navController.focusHotspot(
              new THREE.Vector3(selected.position.x, selected.position.y, selected.position.z)
            );
          } else {
            this.focusModelAll();
          }
        } else if (this.activeMode === 'paths') {
          const selectedWp = this.pathStore.getSelectedWaypoint();
          if (selectedWp) {
            this.navController.focusHotspot(
              new THREE.Vector3(selectedWp.position.x, selectedWp.position.y, selectedWp.position.z)
            );
          }
        }
      }
      // Play / Pause shortcut: Spacebar (if timeline visible)
      else if (e.code === 'Space' && this.activeMode === 'paths') {
        e.preventDefault();
        const state = this.playbackController.getState();
        if (state === 'playing') {
          this.playbackController.pause();
        } else if (state === 'paused') {
          this.playbackController.resume();
        } else {
          const path = this.pathStore.getActivePath();
          if (path) this.playbackController.play(path, this.trajectoryEvaluator);
        }
      }
      // Cancel Placement or Deselect: Esc
      else if (e.code === 'Escape') {
        if (this.isAligningEndOrientation) {
          this.cancelAligningEndOrientation();
        } else if (this.isPlacingHotspot) {
          this.setPlacementMode(false);
        } else if (this.isPlacingWaypoint) {
          this.setWaypointPlacementMode(false);
        } else if (this.playbackController.getState() !== 'idle') {
          this.playbackController.stop();
        } else {
          this.store.select(null);
          this.pathStore.selectWaypoint(null);
        }
      }
    });
  }

  private bindViewportInteractions(): void {
    const canvasWrap = document.getElementById('canvas-3d-wrapper')!;

    canvasWrap.addEventListener('pointerdown', (e) => {
      // If clicking in end transform align mode, allow free navigation (orbit, pan, walk); don't deselect
      if (this.isAligningEndOrientation) {
        return;
      }

      // If clicking in placement mode
      if (this.isPlacingHotspot && e.button === 0) {
        this.handlePlacementClick(e);
        return;
      }
      if (this.isPlacingWaypoint && e.button === 0) {
        this.handleWaypointPlacementClick(e);
        return;
      }

      // If clicking empty space in normal mode, deselect
      if (e.button === 0 && !this.gizmoManager.isDragging()) {
        const hit = this.surfacePicker.pickSurface(
          e.clientX,
          e.clientY,
          this.sceneManager.camera,
          this.sceneManager.currentModelGroup,
          canvasWrap.getBoundingClientRect()
        );
        if (!hit) {
          if (this.activeMode === 'hotspots') {
            this.store.select(null);
          } else {
            this.pathStore.selectWaypoint(null);
          }
        }
      }
    });

    // Viewport floating toolbar buttons
    document.getElementById('btn-nav-orbit')?.addEventListener('click', () => {
      this.navController.setMode('orbit');
      document.getElementById('btn-nav-orbit')?.classList.add('active');
      document.getElementById('btn-nav-walk')?.classList.remove('active');
      this.toastNotification.show('Chế độ Xoay quanh mô hình (Orbit)', 'info');
    });

    document.getElementById('btn-nav-walk')?.addEventListener('click', () => {
      this.navController.setMode('walk');
      document.getElementById('btn-nav-walk')?.classList.add('active');
      document.getElementById('btn-nav-orbit')?.classList.remove('active');
      this.toastNotification.show(
        'Chế độ Đi dạo (Walk/Fly): Dùng chuột xoay hướng nhìn, phím WASD để di chuyển',
        'info'
      );
    });

    document.getElementById('btn-focus-selected')?.addEventListener('click', () => {
      const item = this.store.getSelectedItem();
      if (item) {
        this.navController.focusHotspot(
          new THREE.Vector3(item.position.x, item.position.y, item.position.z)
        );
      } else {
        this.toastNotification.show('Chưa chọn hotspot nào để focus', 'warning');
      }
    });

    document.getElementById('btn-focus-all')?.addEventListener('click', () => {
      this.focusModelAll();
    });

    document.getElementById('btn-reset-camera')?.addEventListener('click', () => {
      this.navController.resetCamera();
    });

    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => {
      this.isGridEnabled = !this.isGridEnabled;
      this.sceneManager.setGridVisible(this.isGridEnabled);
      document.getElementById('btn-toggle-grid')?.classList.toggle('active', this.isGridEnabled);
    });

    document.getElementById('btn-toggle-markers-vis')?.addEventListener('click', () => {
      this.isMarkersVisible = !this.isMarkersVisible;
      this.sceneManager.hotspotLayerGroup.visible = this.isMarkersVisible;
      document.getElementById('btn-toggle-markers-vis')?.classList.toggle('active', this.isMarkersVisible);
      this.toastNotification.show(
        this.isMarkersVisible ? 'Đã hiện lớp Hotspots' : 'Đã ẩn lớp Hotspots để xem mô hình gốc',
        'info'
      );
    });

    document.getElementById('btn-toggle-xray')?.addEventListener('click', () => {
      this.isXRayEnabled = !this.isXRayEnabled;
      document.getElementById('btn-toggle-xray')?.classList.toggle('active', this.isXRayEnabled);
      this.activeMarkers.forEach((m) => m.setXRay(this.isXRayEnabled));
      this.toastNotification.show(
        this.isXRayEnabled ? 'Chế độ X-Ray: Marker hiển thị xuyên vật thể' : 'Chế độ Chuẩn',
        'info'
      );
    });

    // Gizmo Switcher Buttons
    document.getElementById('btn-gizmo-translate')?.addEventListener('click', () => {
      this.setGizmoMode('translate');
    });

    document.getElementById('btn-gizmo-rotate')?.addEventListener('click', () => {
      this.setGizmoMode('rotate');
    });

    // Snap surface button in inspector
    document.getElementById('btn-snap-surface')?.addEventListener('click', () => {
      this.snapSelectedToSurface();
    });
  }

  private setGizmoMode(mode: 'translate' | 'rotate'): void {
    this.gizmoManager.setMode(mode);
    document.getElementById('btn-gizmo-translate')?.classList.toggle('active', mode === 'translate');
    document.getElementById('btn-gizmo-rotate')?.classList.toggle('active', mode === 'rotate');
  }

  private bindTopNavEvents(): void {
    // Add Hotspot Button
    const btnAdd = document.getElementById('btn-add-hotspot')!;
    btnAdd.addEventListener('click', () => {
      this.setPlacementMode(!this.isPlacingHotspot);
    });

    document.getElementById('btn-cancel-placement')?.addEventListener('click', () => {
      if (this.isPlacingHotspot) this.setPlacementMode(false);
      if (this.isPlacingWaypoint) this.setWaypointPlacementMode(false);
    });

    // Save Config Button
    document.getElementById('btn-save-config')?.addEventListener('click', () => {
      this.saveCurrentConfig();
    });

    // Config Dropdown Toggle
    const btnConfigMenu = document.getElementById('btn-config-menu')!;
    const dropdownMenu = document.getElementById('config-dropdown-menu')!;
    btnConfigMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });
    window.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });

    // Export JSON Button
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      this.exportConfigJson();
    });

    // Import JSON File Trigger
    const jsonInput = document.getElementById('json-file-input') as HTMLInputElement;
    document.getElementById('btn-import-json-trigger')?.addEventListener('click', () => {
      jsonInput.click();
    });

    jsonInput.addEventListener('change', async () => {
      const file = jsonInput.files?.[0];
      if (file) {
        await this.importConfigJsonFile(file);
        jsonInput.value = '';
      }
    });

    // Reset Config
    document.getElementById('btn-reset-config')?.addEventListener('click', async () => {
      const confirmed = await this.confirmModal.confirm({
        title: 'Xóa trắng cấu hình',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh sách hotspot và camera paths của mô hình hiện tại?',
        confirmLabel: 'Xóa trắng',
        isDanger: true,
      });
      if (confirmed) {
        this.store.clear(true);
        this.pathStore.clear(true);
        this.toastNotification.show('Đã xóa trắng cấu hình', 'info');
      }
    });

    // Scan Candidates Button
    document.getElementById('btn-detect-candidates')?.addEventListener('click', () => {
      this.scanAndShowCandidates();
    });

    // Keyboard Shortcuts Help Modal
    document.getElementById('btn-help-modal')?.addEventListener('click', () => {
      document.getElementById('modal-help')!.style.display = 'flex';
    });
    document.getElementById('btn-close-help-modal')?.addEventListener('click', () => {
      document.getElementById('modal-help')!.style.display = 'none';
    });
    document.getElementById('btn-close-help-ok')?.addEventListener('click', () => {
      document.getElementById('modal-help')!.style.display = 'none';
    });
  }

  private bindModelImportEvents(): void {
    const modal = document.getElementById('modal-import-model')!;
    const btnOpen = document.getElementById('btn-open-model-modal')!;
    const btnClose = document.getElementById('btn-close-import-modal')!;
    const dropzone = document.getElementById('upload-dropzone')!;
    const fileInput = document.getElementById('model-file-input') as HTMLInputElement;
    const btnBrowse = document.getElementById('btn-browse-file')!;

    btnOpen.addEventListener('click', async () => {
      if (this.store.getIsDirty() || this.pathStore.getIsDirty()) {
        const ok = await this.confirmModal.confirm({
          title: 'Thay đổi chưa lưu',
          message: 'Mô hình hiện tại đang có dữ liệu chưa lưu. Bạn có muốn mở bảng chọn mô hình khác?',
          confirmLabel: 'Tiếp tục',
          isDanger: false,
        });
        if (!ok) return;
      }
      modal.style.display = 'flex';
    });

    btnClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropzone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file) {
        await this.handleModelUpload(file);
      }
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        await this.handleModelUpload(file);
        fileInput.value = '';
      }
    });

    // Sample Models Click Handlers
    document.querySelectorAll('.btn-load-sample').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sampleKey = (btn as HTMLElement).dataset.sample;
        if (sampleKey) {
          modal.style.display = 'none';
          await this.loadSampleModel(sampleKey);
        }
      });
    });
  }

  private setPlacementMode(active: boolean): void {
    this.isPlacingHotspot = active;
    const btnAdd = document.getElementById('btn-add-hotspot')!;
    if (active) {
      btnAdd.classList.add('btn-active');
      this.placementHud.style.display = 'flex';
      this.placementHud.querySelector('span')!.textContent = 'Chế độ đặt Hotspot: Nhấp vào bề mặt mô hình 3D';
      document.body.style.cursor = 'crosshair';
      this.toastNotification.show('Nhấp vào sàn hoặc tường 3D để đặt điểm Hotspot', 'info');
    } else {
      btnAdd.classList.remove('btn-active');
      this.placementHud.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  }

  private handlePlacementClick(e: MouseEvent): void {
    const canvasWrap = document.getElementById('canvas-3d-wrapper')!;
    const hit = this.surfacePicker.pickSurface(
      e.clientX,
      e.clientY,
      this.sceneManager.camera,
      this.sceneManager.currentModelGroup,
      canvasWrap.getBoundingClientRect()
    );

    if (!hit) {
      this.toastNotification.show('Vui lòng nhấp trực tiếp lên bề mặt của mô hình 3D', 'warning');
      return;
    }

    const placementPos = hit.point.clone().addScaledVector(hit.normal, 0.05);
    const count = this.store.getCount() + 1;
    const newHotspot: HotspotItem = {
      id: MathUtils.generateUUID(),
      name: `Điểm số ${count}`,
      type: 'navigation',
      position: MathUtils.roundVector(placementPos, 2),
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
      locked: false,
      marker: {
        color: '#00e5ff',
        size: 1.0,
        showBadge: true,
      },
      source: {
        kind: 'user-created',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.history.execute(new AddHotspotCommand(this.store, newHotspot));
    this.setPlacementMode(false);
    this.toastNotification.show(`Đã tạo "${newHotspot.name}" thành công!`, 'success');
  }

  private handleWaypointPlacementClick(e: MouseEvent): void {
    const canvasWrap = document.getElementById('canvas-3d-wrapper')!;
    const hit = this.surfacePicker.pickSurface(
      e.clientX,
      e.clientY,
      this.sceneManager.camera,
      this.sceneManager.currentModelGroup,
      canvasWrap.getBoundingClientRect()
    );

    if (!hit) {
      this.toastNotification.show('Vui lòng nhấp lên bề mặt mô hình để đặt Waypoint', 'warning');
      return;
    }

    const activePath = this.pathStore.getActivePath();
    if (!activePath) return;

    // Place at eye-level 1.5m above surface if surface is horizontal floor
    const isFloor = hit.normal.y > 0.7;
    const wpPos = hit.point.clone();
    if (isFloor) {
      wpPos.y += 1.5; // Lift to human eye height
    } else {
      wpPos.addScaledVector(hit.normal, 0.5);
    }

    const order = activePath.waypointIds.length + 1;
    const newWaypoint: CameraWaypoint = {
      id: MathUtils.generateUUID(),
      name: `Điểm rẽ P${order}`,
      position: MathUtils.roundVector(wpPos, 2),
      orientation: {
        mode: 'followPath',
        yaw: 0,
        pitch: 0,
        roll: 0,
      },
      locked: false,
      dwellTimeSeconds: 0,
      speedMultiplier: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.history.execute(new AddWaypointCommand(this.pathStore, newWaypoint, activePath.id));
    this.setWaypointPlacementMode(false);
    this.toastNotification.show(`Đã thêm waypoint "${newWaypoint.name}" vào tuyến!`, 'success');
  }

  private snapSelectedToSurface(): void {
    const item = this.store.getSelectedItem();
    if (!item) return;

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(item.position.x, item.position.y + 2, item.position.z),
      new THREE.Vector3(0, -1, 0)
    );
    const intersects = raycaster.intersectObjects(this.sceneManager.currentModelGroup.children, true);

    if (intersects.length > 0 && intersects[0].point) {
      const snapPoint = intersects[0].point.clone().add(new THREE.Vector3(0, 0.05, 0));
      const oldPos = { ...item.position };
      const newPos = MathUtils.roundVector(snapPoint, 2);
      this.history.execute(
        new MoveHotspotCommand(this.store, item.id, oldPos, newPos, item.rotation, item.rotation)
      );
      this.toastNotification.show('Đã bắt điểm vào bề mặt sàn bên dưới', 'success');
    } else {
      this.toastNotification.show('Không tìm thấy bề mặt sàn ngay bên dưới điểm này', 'warning');
    }
  }

  private createOrUpdateMarker(item: HotspotItem): void {
    let marker = this.activeMarkers.get(item.id);
    const allItems = this.store.getAll();
    const index = allItems.findIndex((h) => h.id === item.id) + 1;

    if (!marker) {
      marker = new HotspotMarker2D(item, (selectedItem) => {
        this.store.select(selectedItem.id);
      });
      this.activeMarkers.set(item.id, marker);
      this.sceneManager.hotspotLayerGroup.add(marker.anchor);
    } else {
      marker.updateFromItem(item, index);
    }

    marker.setXRay(this.isXRayEnabled);
    marker.setSelected(item.id === this.store.getSelectedId());
  }

  private removeMarker(id: string): void {
    const marker = this.activeMarkers.get(id);
    if (marker) {
      this.sceneManager.hotspotLayerGroup.remove(marker.anchor);
      marker.dispose();
      this.activeMarkers.delete(id);
    }
  }

  private rebuildAllMarkers(): void {
    this.activeMarkers.forEach((m) => {
      this.sceneManager.hotspotLayerGroup.remove(m.anchor);
      m.dispose();
    });
    this.activeMarkers.clear();

    const items = this.store.getAll();
    for (let i = 0; i < items.length; i++) {
      this.createOrUpdateMarker(items[i]);
    }
  }

  private updateSelectionVisuals(selectedId: string | null): void {
    this.activeMarkers.forEach((marker, id) => {
      marker.setSelected(id === selectedId);
    });
  }

  private async promptDeleteHotspots(items: HotspotItem[]): Promise<void> {
    if (items.length === 0) return;

    const count = items.length;
    const title = count === 1 ? `Xóa Hotspot "${items[0].name}"` : `Xóa ${count} Hotspot`;
    const message =
      count === 1
        ? `Bạn có chắc chắn muốn xóa hotspot <strong>"${items[0].name}"</strong>? Thao tác này chỉ xóa điểm quản trị khỏi hệ thống và không làm thay đổi mô hình gốc.`
        : `Bạn có chắc chắn muốn xóa <strong>${count}</strong> hotspot đã chọn?`;

    const ok = await this.confirmModal.confirm({
      title,
      message,
      confirmLabel: 'Xác nhận xóa',
      isDanger: true,
    });

    if (ok) {
      this.history.execute(new DeleteHotspotCommand(this.store, items));
      this.toastNotification.show(`Đã xóa ${count} hotspot thành công!`, 'info');
    }
  }

  private async handleModelUpload(file: File): Promise<void> {
    const modal = document.getElementById('modal-import-model')!;
    const progressContainer = document.getElementById('upload-progress-container')!;
    const progressLabel = document.getElementById('upload-progress-label')!;
    const progressPct = document.getElementById('upload-progress-pct')!;
    const progressFill = document.getElementById('upload-progress-fill')!;

    progressContainer.style.display = 'block';

    try {
      const result = await this.loaderService.loadFromFile(file, (pct, msg) => {
        progressFill.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
        progressLabel.textContent = msg;
      });

      this.applyLoadedModel(result);
      modal.style.display = 'none';

      if (result.warnings.length > 0) {
        this.toastNotification.show(result.warnings.join(' | '), 'warning', 5000);
      }
    } catch (err: any) {
      alert(`Không thể nạp mô hình: ${err?.message || err}`);
    } finally {
      progressContainer.style.display = 'none';
      progressFill.style.width = '0%';
    }
  }

  public async loadSampleModel(sampleKey: string): Promise<void> {
    const progressContainer = document.getElementById('upload-progress-container')!;
    const progressLabel = document.getElementById('upload-progress-label')!;
    const progressPct = document.getElementById('upload-progress-pct')!;
    const progressFill = document.getElementById('upload-progress-fill')!;

    progressContainer.style.display = 'block';

    try {
      let sampleData: { buffer: ArrayBuffer; name: string };
      if (sampleKey === 'townhouse_clean') {
        sampleData = await SampleModelsCatalog.createTownhouseCleanGlb();
      } else {
        sampleData = await SampleModelsCatalog.createModernApartmentGlb();
      }

      const result = await this.loaderService.loadFromArrayBuffer(
        sampleData.buffer,
        sampleData.name,
        sampleData.buffer.byteLength,
        'glb',
        (pct, msg) => {
          progressFill.style.width = `${pct}%`;
          progressPct.textContent = `${pct}%`;
          progressLabel.textContent = msg;
        }
      );

      this.applyLoadedModel(result);
    } catch (err: any) {
      console.error('Lỗi nạp mô hình mẫu:', err);
      this.toastNotification.show(`Lỗi nạp mô hình mẫu: ${err.message}`, 'error');
    } finally {
      progressContainer.style.display = 'none';
      progressFill.style.width = '0%';
    }
  }

  private applyLoadedModel(result: LoadedModelResult): void {
    // 1. Clear previous model, hotspots & paths
    this.sceneManager.clearCurrentModel();
    this.store.clear(false);
    this.pathStore.clear(false);
    this.history.clear();

    // 2. Add new model to scene graph
    this.sceneManager.currentModelGroup.add(result.model);
    this.currentModelMeta = result.meta;

    // 3. Update top navbar model badge
    document.getElementById('current-model-name')!.textContent = result.meta.fileName;
    document.getElementById('current-model-format')!.textContent = result.meta.format.toUpperCase();
    document.getElementById('current-model-size')!.textContent = MathUtils.formatBytes(result.meta.fileSize);

    // 4. Update HUD triangle count
    let triCount = 0;
    result.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const geom = (child as THREE.Mesh).geometry;
        triCount += geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3;
      }
    });
    document.getElementById('hud-triangles-val')!.textContent = Math.round(triCount).toLocaleString();

    // 5. Focus camera to fit model bounds
    this.navController.focusBounds(result.box);

    // 6. Check for local storage auto-save draft for this model
    const savedConfig = ConfigStorageService.loadFromLocalStorage(result.meta.fingerprint);
    if (savedConfig && savedConfig.hotspots.length > 0) {
      this.store.setAll(savedConfig.hotspots, false);
      if (savedConfig.cameraPaths) {
        this.pathStore.setAll(savedConfig.cameraPaths, savedConfig.waypoints || [], false);
      }
      this.toastNotification.show(
        `Đã tự động tải lại ${savedConfig.hotspots.length} hotspot và ${savedConfig.cameraPaths?.length || 0} tuyến camera!`,
        'success'
      );
    } else if (result.meta.fileName.includes('apartment')) {
      // Auto-populate 3 standard hotspots and 1 sample camera path for the apartment
      const defaultHotspots: HotspotItem[] = [
        {
          id: 'hotspot-living-room',
          name: 'Phòng khách trung tâm',
          type: 'navigation',
          position: { x: 0, y: 1.2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          visible: true,
          locked: false,
          notes: 'Điểm nhìn tổng quan phòng khách và ban công',
          marker: { color: '#00E5FF', size: 1.0, showBadge: true },
          source: { kind: 'imported', nodePath: 'ModernApartmentScene > hotspot_phong_khach' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'hotspot-kitchen',
          name: 'Khu vực Bếp & Bàn ăn',
          type: 'navigation',
          position: { x: 5.5, y: 1.2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          visible: true,
          locked: false,
          notes: 'Đảo bếp và quầy bar sang trọng',
          marker: { color: '#00E5FF', size: 1.0, showBadge: true },
          source: { kind: 'imported', nodePath: 'ModernApartmentScene > hotspot_khu_bep_an' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'hotspot-bedroom',
          name: 'Phòng ngủ Master',
          type: 'navigation',
          position: { x: 0, y: 1.2, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          visible: true,
          locked: false,
          notes: 'Không gian phòng ngủ chính',
          marker: { color: '#00E5FF', size: 1.0, showBadge: true },
          source: { kind: 'imported', nodePath: 'ModernApartmentScene > hotspot_phong_ngu_master' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      this.store.setAll(defaultHotspots, false);

      // Create 1 sample Camera Path with 1 intermediate waypoint
      const sampleWp: CameraWaypoint = {
        id: 'wp-sample-turn',
        name: 'Điểm rẽ hành lang P1',
        position: { x: 2.75, y: 1.5, z: -0.8 },
        orientation: { mode: 'followPath', yaw: 0, pitch: 0, roll: 0 },
        locked: false,
        dwellTimeSeconds: 0,
        speedMultiplier: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const samplePath: CameraPath = {
        id: 'path-sample-tour',
        name: 'Tuyến: Phòng khách → Bếp & Ăn',
        fromHotspotId: 'hotspot-living-room',
        toHotspotId: 'hotspot-kitchen',
        waypointIds: [sampleWp.id],
        curveType: 'spline',
        tension: 0.5,
        durationSeconds: 8.0,
        easing: 'easeInOut',
        bidirectional: false,
        enabled: true,
        warnings: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.pathStore.setAll([samplePath], [sampleWp], false);
      this.toastNotification.show(
        'Đã sẵn sàng mô hình căn hộ với 3 Hotspot và 1 Tuyến camera mẫu!',
        'success'
      );
    } else {
      // 7. Auto scan for candidate hotspots if no previous draft
      this.scanAndShowCandidates();
    }

    this.toastNotification.show(`Đã nạp mô hình "${result.meta.fileName}" thành công!`, 'success');
  }

  private scanAndShowCandidates(): void {
    const candidates = CandidateDetector.detect(this.sceneManager.currentModelGroup);
    if (candidates.length > 0) {
      this.candidateModal.show(candidates);
    } else {
      this.toastNotification.show('Không tìm thấy candidate hotspot tự động trong file này.', 'info');
    }
  }

  private focusModelAll(): void {
    const box = new THREE.Box3().setFromObject(this.sceneManager.currentModelGroup);
    this.navController.focusBounds(box);
  }

  // --- END ORIENTATION & TRANSFORM INTERACTIVE ALIGNMENT ---
  private getCurrentCameraTransform(): {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    roll: number;
  } {
    const cam = this.sceneManager.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const yaw = (THREE.MathUtils.radToDeg(Math.atan2(-fwd.x, -fwd.z)) + 360) % 360;
    const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, fwd.y))));
    return {
      position: {
        x: Math.round(cam.position.x * 100) / 100,
        y: Math.round(cam.position.y * 100) / 100,
        z: Math.round(cam.position.z * 100) / 100,
      },
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: 0,
    };
  }

  private bindEndOrientationHudEvents(): void {
    const btnSaveAll = document.getElementById('btn-save-end-all-hud');
    const btnSaveRot = document.getElementById('btn-save-end-rot-hud');
    const btnReset = document.getElementById('btn-reset-end-orient-hud');
    const btnCancel = document.getElementById('btn-cancel-end-orient-hud');

    if (btnSaveAll) {
      btnSaveAll.addEventListener('click', () => this.saveEndTransform(true));
    }
    if (btnSaveRot) {
      btnSaveRot.addEventListener('click', () => this.saveEndTransform(false));
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetEndOrientationToHotspotInHud());
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.cancelAligningEndOrientation());
    }
  }

  private startAligningEndOrientation(): void {
    const activePath = this.pathStore.getActivePath();
    if (!activePath) {
      this.toastNotification.show('Vui lòng chọn một tuyến camera trước!', 'warning');
      return;
    }

    const toHotspot = this.store.getById(activePath.toHotspotId);
    if (!toHotspot) {
      this.toastNotification.show('Không tìm thấy Hotspot đích của tuyến camera này!', 'warning');
      return;
    }

    if (this.isAligningEndOrientation) return;

    // Stop playback if running
    if (this.playbackController.getState() !== 'idle') {
      this.playbackController.stop();
    }

    // Save camera snapshot to restore if cancelled
    this.endOrientCameraSnapshot = {
      position: this.sceneManager.camera.position.clone(),
      quaternion: this.sceneManager.camera.quaternion.clone(),
      target: this.navController.orbitControls.target.clone(),
    };

    // Determine initial camera position: custom endPosition or destination hotspot
    const startPos = (activePath.useCustomEndPosition && activePath.endPosition)
      ? activePath.endPosition
      : (activePath.endOrientation?.useCustomPosition && activePath.endOrientation?.position)
      ? activePath.endOrientation.position
      : toHotspot.position;

    // Determine initial yaw, pitch, roll
    let yaw = 0;
    let pitch = 0;
    let roll = 0;

    if (activePath.endOrientation && activePath.endOrientation.mode === 'custom' && activePath.endOrientation.yaw !== undefined) {
      yaw = activePath.endOrientation.yaw;
      pitch = activePath.endOrientation.pitch ?? 0;
      roll = activePath.endOrientation.roll ?? 0;
    } else if (toHotspot.rotation) {
      yaw = toHotspot.rotation.y ?? 0;
      pitch = toHotspot.rotation.x ?? 0;
      roll = toHotspot.rotation.z ?? 0;
    } else {
      const fwd = new THREE.Vector3();
      this.sceneManager.camera.getWorldDirection(fwd);
      yaw = (THREE.MathUtils.radToDeg(Math.atan2(-fwd.x, -fwd.z)) + 360) % 360;
      pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, fwd.y))));
    }

    // Apply starting pose to camera
    const pitchRad = THREE.MathUtils.degToRad(pitch);
    const yawRad = THREE.MathUtils.degToRad(yaw);
    const rollRad = THREE.MathUtils.degToRad(roll);
    const euler = new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler);

    this.sceneManager.camera.position.set(startPos.x, startPos.y, startPos.z);
    this.sceneManager.camera.quaternion.copy(q);

    // Look target 3 units in front and ensure OrbitControls is enabled for free navigation
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    this.navController.orbitControls.target.copy(this.sceneManager.camera.position).addScaledVector(fwd, 3);
    this.navController.orbitControls.enabled = true;
    this.navController.orbitControls.update();

    // Switch mode to custom in path if not already
    if (!activePath.endOrientation || activePath.endOrientation.mode !== 'custom') {
      activePath.endOrientation = {
        mode: 'custom',
        useCustomPosition: Boolean(activePath.useCustomEndPosition),
        position: startPos,
        yaw: Math.round(yaw * 10) / 10,
        pitch: Math.round(pitch * 10) / 10,
        roll: Math.round(roll * 10) / 10,
        transitionDuration: activePath.endOrientation?.transitionDuration ?? 2.0,
        easing: activePath.endOrientation?.easing ?? 'easeInOut',
      };
      this.pathPropertyPanel.updateFromStore();
    }

    this.isAligningEndOrientation = true;
    this.endOrientHud.style.display = 'flex';
    document.body.style.cursor = 'default';

    this.updateAligningHudDisplays();

    this.toastNotification.show(
      'Chế độ căn điểm cuối: Tự do lướt và di chuyển trong không gian 3D (Orbit / Pan / Zoom / Walk)',
      'info'
    );
  }

  private updateAligningHudDisplays(): void {
    const cam = this.sceneManager.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const yaw = (THREE.MathUtils.radToDeg(Math.atan2(-fwd.x, -fwd.z)) + 360) % 360;
    const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, fwd.y))));

    const posXEl = document.getElementById('hud-end-pos-x');
    const posYEl = document.getElementById('hud-end-pos-y');
    const posZEl = document.getElementById('hud-end-pos-z');
    const yawEl = document.getElementById('hud-end-yaw-val');
    const pitchEl = document.getElementById('hud-end-pitch-val');

    if (posXEl) posXEl.textContent = cam.position.x.toFixed(2);
    if (posYEl) posYEl.textContent = cam.position.y.toFixed(2);
    if (posZEl) posZEl.textContent = cam.position.z.toFixed(2);
    if (yawEl) yawEl.textContent = `${Math.round(yaw)}°`;
    if (pitchEl) pitchEl.textContent = `${Math.round(pitch)}°`;

    this.pathPropertyPanel.updateEndTransformValues(
      { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      yaw,
      pitch,
      0
    );
  }

  private saveEndTransform(includePosition: boolean): void {
    const activePath = this.pathStore.getActivePath();
    if (!activePath) {
      this.exitAligningEndOrientation(false);
      return;
    }

    const transform = this.getCurrentCameraTransform();
    const toHotspot = this.store.getById(activePath.toHotspotId);

    const pos = includePosition
      ? transform.position
      : (toHotspot ? { x: toHotspot.position.x, y: toHotspot.position.y, z: toHotspot.position.z } : undefined);

    const updatedOrient: PathTerminalOrientation = {
      mode: 'custom',
      useCustomPosition: includePosition,
      position: pos,
      yaw: transform.yaw,
      pitch: transform.pitch,
      roll: 0,
      transitionDuration: activePath.endOrientation?.transitionDuration ?? 2.0,
      easing: activePath.endOrientation?.easing ?? 'easeInOut',
    };

    const updatedPath: CameraPath = {
      ...activePath,
      useCustomEndPosition: includePosition,
      endPosition: pos,
      endOrientation: updatedOrient,
      updatedAt: new Date().toISOString(),
    };

    this.history.execute(
      new UpdatePathCommand(
        this.pathStore,
        activePath,
        updatedPath,
        includePosition ? 'điểm cuối (vị trí & góc nhìn)' : 'hướng nhìn điểm cuối'
      )
    );

    this.toastNotification.show(
      includePosition
        ? 'Đã lưu cả Vị trí & Hướng nhìn camera điểm cuối cho tuyến!'
        : 'Đã lưu Hướng nhìn camera điểm cuối (neo tại Hotspot đích)!',
      'success'
    );
    this.exitAligningEndOrientation(false);
    this.syncActivePathVisuals();
    this.pathPropertyPanel.updateFromStore();
  }

  private resetEndOrientationToHotspotInHud(): void {
    const activePath = this.pathStore.getActivePath();
    if (!activePath) return;

    const toHotspot = this.store.getById(activePath.toHotspotId);
    if (!toHotspot) return;

    const yaw = toHotspot.rotation ? (toHotspot.rotation.y ?? 0) : 0;
    const pitch = toHotspot.rotation ? (toHotspot.rotation.x ?? 0) : 0;
    const roll = toHotspot.rotation ? (toHotspot.rotation.z ?? 0) : 0;

    const pitchRad = THREE.MathUtils.degToRad(pitch);
    const yawRad = THREE.MathUtils.degToRad(yaw);
    const rollRad = THREE.MathUtils.degToRad(roll);
    const euler = new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler);

    this.sceneManager.camera.position.set(toHotspot.position.x, toHotspot.position.y, toHotspot.position.z);
    this.sceneManager.camera.quaternion.copy(q);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    this.navController.orbitControls.target.copy(this.sceneManager.camera.position).addScaledVector(fwd, 3);
    this.navController.orbitControls.update();

    this.updateAligningHudDisplays();
    this.toastNotification.show('Đã đưa camera về vị trí và góc nhìn gốc của Hotspot đích', 'info');
  }

  private cancelAligningEndOrientation(): void {
    this.exitAligningEndOrientation(true);
    this.toastNotification.show('Đã hủy thao tác căn hướng nhìn', 'info');
  }

  private exitAligningEndOrientation(restoreSnapshot: boolean): void {
    this.isAligningEndOrientation = false;
    this.endOrientHud.style.display = 'none';
    document.body.style.cursor = 'default';
    this.navController.orbitControls.enabled = true;

    if (restoreSnapshot && this.endOrientCameraSnapshot) {
      this.sceneManager.camera.position.copy(this.endOrientCameraSnapshot.position);
      this.sceneManager.camera.quaternion.copy(this.endOrientCameraSnapshot.quaternion);
      this.navController.orbitControls.target.copy(this.endOrientCameraSnapshot.target);
      this.navController.orbitControls.update();
    }
    this.endOrientCameraSnapshot = null;
  }

  private saveCurrentConfig(): void {
    if (!this.currentModelMeta) {
      this.toastNotification.show('Chưa có mô hình nào được nạp', 'warning');
      return;
    }

    ConfigStorageService.saveToLocalStorage(this.store, this.currentModelMeta, this.pathStore);
    this.store.setDirty(false);
    this.pathStore.setDirty(false);
    this.toastNotification.show('Đã lưu cấu hình Hotspots và Tuyến camera thành công!', 'success');
  }

  private exportConfigJson(): void {
    if (!this.currentModelMeta) {
      this.toastNotification.show('Chưa có mô hình nào được nạp', 'warning');
      return;
    }

    const json = ConfigStorageService.exportToJson(
      this.store,
      this.currentModelMeta,
      this.pathStore,
      `Cấu hình Hotspot & Camera Paths - ${this.currentModelMeta.fileName}`
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotspots_and_paths_${this.currentModelMeta.fileName.replace(/\.[^/.]+$/, '')}_v1.1.0.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.store.setDirty(false);
    this.pathStore.setDirty(false);
    this.toastNotification.show('Đã xuất file cấu hình JSON thành công!', 'success');
  }

  private async importConfigJsonFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const res = ConfigStorageService.validateAndParse(text, this.currentModelMeta || undefined);

      if (!res.valid || !res.config) {
        this.toastNotification.show(res.error || 'File JSON không hợp lệ!', 'error');
        return;
      }

      if (res.warning) {
        const proceed = await this.confirmModal.confirm({
          title: 'Cảnh báo không khớp mô hình',
          message: `${res.warning}<br/><br/>Bạn có chắc chắn muốn tiếp tục nạp cấu hình này?`,
          confirmLabel: 'Vẫn nạp',
          isDanger: true,
        });
        if (!proceed) return;
      }

      this.store.setAll(res.config.hotspots, true);
      if (res.config.cameraPaths) {
        this.pathStore.setAll(res.config.cameraPaths, res.config.waypoints || [], true);
      }
      this.toastNotification.show(
        `Đã nhập thành công ${res.config.hotspots.length} hotspot và ${res.config.cameraPaths?.length || 0} tuyến camera!`,
        'success'
      );
    } catch (err: any) {
      this.toastNotification.show(`Lỗi nạp file JSON: ${err.message}`, 'error');
    }
  }
}
