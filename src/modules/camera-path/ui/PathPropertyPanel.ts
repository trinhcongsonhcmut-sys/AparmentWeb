import { CameraPathStore } from '../store/CameraPathStore';
import { HotspotStore } from '../../hotspots/store/HotspotStore';
import { CommandHistory } from '../../../shared/history/CommandHistory';
import { UpdatePathCommand } from '../commands/UpdatePathCommand';
import { MoveWaypointCommand } from '../commands/MoveWaypointCommand';
import { DeleteWaypointCommand } from '../commands/DeleteWaypointCommand';
import { DeletePathCommand } from '../commands/DeletePathCommand';
import { CameraPath, CameraWaypoint, WaypointOrientationMode, CameraPathCurveType, CameraPathEasing } from '../types/cameraPath.types';
import { MathUtils } from '../../../shared/math/MathUtils';

export class PathPropertyPanel {
  private pathStore: CameraPathStore;
  private hotspotStore: HotspotStore;
  private history: CommandHistory;

  private emptyState: HTMLElement;
  private pathForm: HTMLElement;
  private waypointForm: HTMLElement;

  // Path Form Fields
  private inputPathName: HTMLInputElement;
  private selectFromHotspot: HTMLSelectElement;
  private selectToHotspot: HTMLSelectElement;
  private selectCurveType: HTMLSelectElement;
  private sliderTension: HTMLInputElement;
  private valTension: HTMLElement;
  private inputDuration: HTMLInputElement;
  private selectEasing: HTMLSelectElement;
  private pathWarningsBox: HTMLElement;
  private btnReversePath: HTMLButtonElement;
  private btnDuplicatePath: HTMLButtonElement;
  private btnDeletePath: HTMLButtonElement;

  // End Orientation & Transform Form Fields
  private selectEndMode: HTMLSelectElement;
  private boxEndCustomFields: HTMLElement;
  private btnAlignEndOrientViewport: HTMLButtonElement;
  private chkPathEndCustomPos: HTMLInputElement;
  private boxPathEndPosFields: HTMLElement;
  private btnPathEndPosCurrent: HTMLButtonElement;
  private inputEndPosX: HTMLInputElement;
  private inputEndPosY: HTMLInputElement;
  private inputEndPosZ: HTMLInputElement;
  private inputEndYaw: HTMLInputElement;
  private inputEndPitch: HTMLInputElement;
  private inputEndRoll: HTMLInputElement;
  private sliderEndTransition: HTMLInputElement;
  private valEndTransition: HTMLElement;
  private selectEndEasing: HTMLSelectElement;
  private btnResetEndOrientToHotspot: HTMLButtonElement;

  private onStartAlignEndOrientation?: () => void;
  private onGetCurrentCameraTransform?: () => { position: { x: number; y: number; z: number }; yaw: number; pitch: number; roll: number };

  // Waypoint Form Fields
  private inputWpName: HTMLInputElement;
  private inputWpPosX: HTMLInputElement;
  private inputWpPosY: HTMLInputElement;
  private inputWpPosZ: HTMLInputElement;
  private btnEyeLevel: HTMLButtonElement;
  private selectOrientationMode: HTMLSelectElement;
  private rowManualAngles: HTMLElement;
  private inputWpYaw: HTMLInputElement;
  private inputWpPitch: HTMLInputElement;
  private inputWpDwell: HTMLInputElement;
  private chkWpLocked: HTMLInputElement;
  private btnDeleteWp: HTMLButtonElement;

  private isInternalUpdate: boolean = false;

  constructor(
    pathStore: CameraPathStore,
    hotspotStore: HotspotStore,
    history: CommandHistory,
    onStartAlignEndOrientation?: () => void
  ) {
    this.pathStore = pathStore;
    this.hotspotStore = hotspotStore;
    this.history = history;
    this.onStartAlignEndOrientation = onStartAlignEndOrientation;

    this.emptyState = document.getElementById('path-inspector-empty')!;
    this.pathForm = document.getElementById('path-inspector-form')!;
    this.waypointForm = document.getElementById('waypoint-inspector-form')!;

    // Path inputs
    this.inputPathName = document.getElementById('prop-path-name') as HTMLInputElement;
    this.selectFromHotspot = document.getElementById('prop-path-from') as HTMLSelectElement;
    this.selectToHotspot = document.getElementById('prop-path-to') as HTMLSelectElement;
    this.selectCurveType = document.getElementById('prop-path-curve') as HTMLSelectElement;
    this.sliderTension = document.getElementById('prop-path-tension') as HTMLInputElement;
    this.valTension = document.getElementById('val-path-tension')!;
    this.inputDuration = document.getElementById('prop-path-duration') as HTMLInputElement;
    this.selectEasing = document.getElementById('prop-path-easing') as HTMLSelectElement;
    this.pathWarningsBox = document.getElementById('path-warnings-box')!;
    this.btnReversePath = document.getElementById('btn-path-reverse') as HTMLButtonElement;
    this.btnDuplicatePath = document.getElementById('btn-path-duplicate') as HTMLButtonElement;
    this.btnDeletePath = document.getElementById('btn-path-delete') as HTMLButtonElement;

    // End Orientation & Transform inputs
    this.selectEndMode = document.getElementById('prop-path-end-mode') as HTMLSelectElement;
    this.boxEndCustomFields = document.getElementById('path-end-orient-custom-fields')!;
    this.btnAlignEndOrientViewport = document.getElementById('btn-align-end-orient-viewport') as HTMLButtonElement;
    this.chkPathEndCustomPos = document.getElementById('chk-path-end-custom-pos') as HTMLInputElement;
    this.boxPathEndPosFields = document.getElementById('path-end-pos-fields')!;
    this.btnPathEndPosCurrent = document.getElementById('btn-path-end-pos-current') as HTMLButtonElement;
    this.inputEndPosX = document.getElementById('prop-path-end-pos-x') as HTMLInputElement;
    this.inputEndPosY = document.getElementById('prop-path-end-pos-y') as HTMLInputElement;
    this.inputEndPosZ = document.getElementById('prop-path-end-pos-z') as HTMLInputElement;
    this.inputEndYaw = document.getElementById('prop-path-end-yaw') as HTMLInputElement;
    this.inputEndPitch = document.getElementById('prop-path-end-pitch') as HTMLInputElement;
    this.inputEndRoll = document.getElementById('prop-path-end-roll') as HTMLInputElement;
    this.sliderEndTransition = document.getElementById('prop-path-end-transition') as HTMLInputElement;
    this.valEndTransition = document.getElementById('val-path-end-transition')!;
    this.selectEndEasing = document.getElementById('prop-path-end-easing') as HTMLSelectElement;
    this.btnResetEndOrientToHotspot = document.getElementById('btn-reset-end-orient-to-hotspot') as HTMLButtonElement;

    // Waypoint inputs
    this.inputWpName = document.getElementById('prop-wp-name') as HTMLInputElement;
    this.inputWpPosX = document.getElementById('prop-wp-pos-x') as HTMLInputElement;
    this.inputWpPosY = document.getElementById('prop-wp-pos-y') as HTMLInputElement;
    this.inputWpPosZ = document.getElementById('prop-wp-pos-z') as HTMLInputElement;
    this.btnEyeLevel = document.getElementById('btn-wp-eye-level') as HTMLButtonElement;
    this.selectOrientationMode = document.getElementById('prop-wp-orient-mode') as HTMLSelectElement;
    this.rowManualAngles = document.getElementById('row-manual-angles')!;
    this.inputWpYaw = document.getElementById('prop-wp-yaw') as HTMLInputElement;
    this.inputWpPitch = document.getElementById('prop-wp-pitch') as HTMLInputElement;
    this.inputWpDwell = document.getElementById('prop-wp-dwell') as HTMLInputElement;
    this.chkWpLocked = document.getElementById('prop-wp-locked') as HTMLInputElement;
    this.btnDeleteWp = document.getElementById('btn-wp-delete') as HTMLButtonElement;

    this.bindEvents();
    this.pathStore.subscribe(() => this.updateFromStore());
  }

  private bindEvents(): void {
    // --- PATH EVENTS ---
    this.inputPathName.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, name: this.inputPathName.value.trim() || 'Tuyến camera' };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'tên'));
    });

    this.selectFromHotspot.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, fromHotspotId: this.selectFromHotspot.value };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'điểm xuất phát'));
    });

    this.selectToHotspot.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, toHotspotId: this.selectToHotspot.value };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'điểm đích'));
    });

    this.selectCurveType.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, curveType: this.selectCurveType.value as CameraPathCurveType };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'kiểu đường'));
    });

    this.sliderTension.addEventListener('input', () => {
      this.valTension.textContent = this.sliderTension.value;
    });

    this.sliderTension.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, tension: parseFloat(this.sliderTension.value) };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'độ căng spline'));
    });

    this.inputDuration.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const dur = Math.max(1, parseFloat(this.inputDuration.value) || 8);
      const next = { ...path, durationSeconds: dur };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'thời lượng'));
    });

    this.selectEasing.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const next = { ...path, easing: this.selectEasing.value as CameraPathEasing };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'độ mượt easing'));
    });

    this.btnReversePath.addEventListener('click', () => {
      const path = this.pathStore.getActivePath();
      if (path) this.pathStore.reversePath(path.id);
    });

    this.btnDuplicatePath.addEventListener('click', () => {
      const path = this.pathStore.getActivePath();
      if (path) this.pathStore.duplicatePath(path.id);
    });

    // --- END ORIENTATION EVENTS ---
    this.selectEndMode.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const mode = this.selectEndMode.value as any;
      const prevEnd = path.endOrientation || { mode: 'hotspot' };
      const toHotspot = this.hotspotStore.getById(path.toHotspotId);

      const nextEnd = {
        ...prevEnd,
        mode,
        yaw: prevEnd.yaw ?? (toHotspot?.rotation?.y || 0),
        pitch: prevEnd.pitch ?? (toHotspot?.rotation?.x || 0),
        roll: prevEnd.roll ?? (toHotspot?.rotation?.z || 0),
        transitionDuration: prevEnd.transitionDuration ?? 2.0,
      };

      const next = { ...path, endOrientation: nextEnd };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'chế độ hướng nhìn đích'));
    });

    const onEndAngleChange = () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const yaw = MathUtils.round(parseFloat(this.inputEndYaw.value) || 0, 1);
      const pitch = MathUtils.round(parseFloat(this.inputEndPitch.value) || 0, 1);
      const roll = MathUtils.round(parseFloat(this.inputEndRoll.value) || 0, 1);

      const nextEnd = {
        ...(path.endOrientation || { mode: 'custom' }),
        mode: 'custom' as const,
        yaw: (yaw % 360 + 360) % 360,
        pitch: Math.max(-85, Math.min(85, pitch)),
        roll,
      };

      const next = { ...path, endOrientation: nextEnd };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'góc hướng nhìn đích'));
    };

    this.inputEndYaw.addEventListener('change', onEndAngleChange);
    this.inputEndPitch.addEventListener('change', onEndAngleChange);
    this.inputEndRoll.addEventListener('change', onEndAngleChange);

    this.sliderEndTransition.addEventListener('input', () => {
      this.valEndTransition.textContent = `${this.sliderEndTransition.value}s`;
    });

    this.sliderEndTransition.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const dur = parseFloat(this.sliderEndTransition.value) || 2.0;
      const nextEnd = {
        ...(path.endOrientation || { mode: 'custom' }),
        transitionDuration: dur,
      };
      const next = { ...path, endOrientation: nextEnd };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'thời lượng xoay đích'));
    });

    this.selectEndEasing.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const easing = this.selectEndEasing.value as any;
      const nextEnd = {
        ...(path.endOrientation || { mode: 'custom' }),
        easing,
      };
      const next = { ...path, endOrientation: nextEnd };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'độ mượt xoay đích'));
    });

    this.btnAlignEndOrientViewport.addEventListener('click', () => {
      this.onStartAlignEndOrientation?.();
    });

    this.chkPathEndCustomPos.addEventListener('change', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const checked = this.chkPathEndCustomPos.checked;
      this.boxPathEndPosFields.style.display = checked ? 'flex' : 'none';

      const toHotspot = this.hotspotStore.getById(path.toHotspotId);
      const posX = path.endPosition ? path.endPosition.x : (toHotspot?.position.x || 0);
      const posY = path.endPosition ? path.endPosition.y : (toHotspot?.position.y || 0);
      const posZ = path.endPosition ? path.endPosition.z : (toHotspot?.position.z || 0);

      const next: CameraPath = {
        ...path,
        useCustomEndPosition: checked,
        endPosition: { x: posX, y: posY, z: posZ },
        endOrientation: {
          ...(path.endOrientation || { mode: 'hotspot' }),
          useCustomPosition: checked,
          position: { x: posX, y: posY, z: posZ },
        },
      };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'tùy chỉnh vị trí đích'));
    });

    const onEndPosChange = () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const x = MathUtils.round(parseFloat(this.inputEndPosX.value) || 0, 2);
      const y = MathUtils.round(parseFloat(this.inputEndPosY.value) || 0, 2);
      const z = MathUtils.round(parseFloat(this.inputEndPosZ.value) || 0, 2);

      const next: CameraPath = {
        ...path,
        useCustomEndPosition: true,
        endPosition: { x, y, z },
        endOrientation: {
          ...(path.endOrientation || { mode: 'hotspot' }),
          useCustomPosition: true,
          position: { x, y, z },
        },
      };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'tọa độ vị trí đích'));
    };

    this.inputEndPosX.addEventListener('change', onEndPosChange);
    this.inputEndPosY.addEventListener('change', onEndPosChange);
    this.inputEndPosZ.addEventListener('change', onEndPosChange);

    this.btnPathEndPosCurrent.addEventListener('click', () => {
      const path = this.pathStore.getActivePath();
      if (!path || !this.onGetCurrentCameraTransform) return;
      const transform = this.onGetCurrentCameraTransform();
      const pos = {
        x: MathUtils.round(transform.position.x, 2),
        y: MathUtils.round(transform.position.y, 2),
        z: MathUtils.round(transform.position.z, 2),
      };

      const next: CameraPath = {
        ...path,
        useCustomEndPosition: true,
        endPosition: pos,
        endOrientation: {
          ...(path.endOrientation || { mode: 'custom' }),
          useCustomPosition: true,
          position: pos,
        },
      };
      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'lấy vị trí camera hiện tại'));
    });

    this.btnResetEndOrientToHotspot.addEventListener('click', () => {
      const path = this.pathStore.getActivePath();
      if (!path || this.isInternalUpdate) return;
      const toHotspot = this.hotspotStore.getById(path.toHotspotId);
      const hYaw = toHotspot?.rotation?.y || 0;
      const hPitch = toHotspot?.rotation?.x || 0;
      const hRoll = toHotspot?.rotation?.z || 0;
      const hPos = toHotspot ? { x: toHotspot.position.x, y: toHotspot.position.y, z: toHotspot.position.z } : undefined;

      const next: CameraPath = {
        ...path,
        useCustomEndPosition: false,
        endPosition: hPos,
        endOrientation: {
          mode: 'hotspot',
          useCustomPosition: false,
          position: hPos,
          yaw: hYaw,
          pitch: hPitch,
          roll: hRoll,
          transitionDuration: path.endOrientation?.transitionDuration ?? 2.0,
          easing: path.endOrientation?.easing ?? 'easeInOut',
        },
      };

      this.history.execute(new UpdatePathCommand(this.pathStore, path, next, 'khôi phục theo hotspot đích'));
    });

    this.btnDeletePath.addEventListener('click', () => {
      const path = this.pathStore.getActivePath();
      if (path) {
        if (confirm(`Bạn có chắc chắn muốn xóa tuyến "${path.name}"?`)) {
          this.history.execute(new DeletePathCommand(this.pathStore, path));
        }
      }
    });

    // --- WAYPOINT EVENTS ---
    this.inputWpName.addEventListener('change', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const next = { ...wp, name: this.inputWpName.value.trim() || 'Waypoint' };
      this.pathStore.updateWaypoint(next, true);
    });

    const onWpCoordChange = () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const x = parseFloat(this.inputWpPosX.value) || 0;
      const y = parseFloat(this.inputWpPosY.value) || 0;
      const z = parseFloat(this.inputWpPosZ.value) || 0;
      const prevPos = { ...wp.position };
      const newPos = { x: MathUtils.round(x, 2), y: MathUtils.round(y, 2), z: MathUtils.round(z, 2) };
      this.history.execute(new MoveWaypointCommand(this.pathStore, wp.id, prevPos, newPos, wp.orientation, wp.orientation));
    };

    this.inputWpPosX.addEventListener('change', onWpCoordChange);
    this.inputWpPosY.addEventListener('change', onWpCoordChange);
    this.inputWpPosZ.addEventListener('change', onWpCoordChange);

    this.btnEyeLevel.addEventListener('click', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp) return;
      const prevPos = { ...wp.position };
      const newPos = { ...wp.position, y: 1.5 }; // Standard 1.5m eye height
      this.history.execute(new MoveWaypointCommand(this.pathStore, wp.id, prevPos, newPos, wp.orientation, wp.orientation));
    });

    this.selectOrientationMode.addEventListener('change', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const mode = this.selectOrientationMode.value as WaypointOrientationMode;
      const next = { ...wp, orientation: { ...wp.orientation, mode } };
      this.pathStore.updateWaypoint(next, true);
      this.rowManualAngles.style.display = mode === 'manual' ? 'grid' : 'none';
    });

    const onAngleChange = () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const yaw = parseFloat(this.inputWpYaw.value) || 0;
      const pitch = parseFloat(this.inputWpPitch.value) || 0;
      const prevOrient = { ...wp.orientation };
      const nextOrient = { ...wp.orientation, yaw, pitch };
      this.history.execute(new MoveWaypointCommand(this.pathStore, wp.id, wp.position, wp.position, prevOrient, nextOrient));
    };

    this.inputWpYaw.addEventListener('change', onAngleChange);
    this.inputWpPitch.addEventListener('change', onAngleChange);

    this.inputWpDwell.addEventListener('change', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const dwell = Math.max(0, parseFloat(this.inputWpDwell.value) || 0);
      const next = { ...wp, dwellTimeSeconds: dwell };
      this.pathStore.updateWaypoint(next, true);
    });

    this.chkWpLocked.addEventListener('change', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      if (!wp || this.isInternalUpdate) return;
      const next = { ...wp, locked: this.chkWpLocked.checked };
      this.pathStore.updateWaypoint(next, true);
    });

    this.btnDeleteWp.addEventListener('click', () => {
      const wp = this.pathStore.getSelectedWaypoint();
      const path = this.pathStore.getActivePath();
      if (wp && path) {
        this.history.execute(new DeleteWaypointCommand(this.pathStore, wp, path.id));
      }
    });
  }

  public updateFromStore(): void {
    const activePath = this.pathStore.getActivePath();
    const selectedWp = this.pathStore.getSelectedWaypoint();

    if (!activePath) {
      this.emptyState.style.display = 'flex';
      this.pathForm.style.display = 'none';
      this.waypointForm.style.display = 'none';
      return;
    }

    this.emptyState.style.display = 'none';

    // If a waypoint is selected, show waypoint form; otherwise show path form
    if (selectedWp) {
      this.pathForm.style.display = 'none';
      this.waypointForm.style.display = 'block';
      this.renderWaypointFields(selectedWp);
    } else {
      this.pathForm.style.display = 'block';
      this.waypointForm.style.display = 'none';
      this.renderPathFields(activePath);
    }

    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }

  public updateWaypointCoords(pos: { x: number; y: number; z: number }): void {
    this.isInternalUpdate = true;
    this.inputWpPosX.value = String(MathUtils.round(pos.x, 2));
    this.inputWpPosY.value = String(MathUtils.round(pos.y, 2));
    this.inputWpPosZ.value = String(MathUtils.round(pos.z, 2));
    this.isInternalUpdate = false;
  }

  private renderPathFields(path: CameraPath): void {
    this.isInternalUpdate = true;
    this.inputPathName.value = path.name;

    // Populate start/end hotspot selects
    const hotspots = this.hotspotStore.getAll();
    this.selectFromHotspot.innerHTML = '';
    this.selectToHotspot.innerHTML = '';

    hotspots.forEach((h) => {
      const optFrom = document.createElement('option');
      optFrom.value = h.id;
      optFrom.textContent = h.name;
      if (h.id === path.fromHotspotId) optFrom.selected = true;
      this.selectFromHotspot.appendChild(optFrom);

      const optTo = document.createElement('option');
      optTo.value = h.id;
      optTo.textContent = h.name;
      if (h.id === path.toHotspotId) optTo.selected = true;
      this.selectToHotspot.appendChild(optTo);
    });

    this.selectCurveType.value = path.curveType || 'spline';
    this.sliderTension.value = String(path.tension !== undefined ? path.tension : 0.5);
    this.valTension.textContent = this.sliderTension.value;
    this.inputDuration.value = String(path.durationSeconds || 8);
    this.selectEasing.value = path.easing || 'easeInOut';

    // Warnings
    if (path.warnings && path.warnings.length > 0) {
      this.pathWarningsBox.style.display = 'flex';
      this.pathWarningsBox.textContent = path.warnings.join('; ');
    } else {
      this.pathWarningsBox.style.display = 'none';
    }

    // End Position fields
    const toHotspot = this.hotspotStore.getById(path.toHotspotId);
    const hasCustomPos = Boolean(path.useCustomEndPosition || path.endOrientation?.useCustomPosition);
    this.chkPathEndCustomPos.checked = hasCustomPos;
    this.boxPathEndPosFields.style.display = hasCustomPos ? 'flex' : 'none';

    const endPos = (hasCustomPos && (path.endPosition || path.endOrientation?.position))
      ? (path.endPosition || path.endOrientation!.position!)
      : (toHotspot?.position || { x: 0, y: 0, z: 0 });

    this.inputEndPosX.value = String(MathUtils.round(endPos.x, 2));
    this.inputEndPosY.value = String(MathUtils.round(endPos.y, 2));
    this.inputEndPosZ.value = String(MathUtils.round(endPos.z, 2));

    // End Orientation fields
    const end = path.endOrientation || { mode: 'hotspot' };
    this.selectEndMode.value = end.mode || 'hotspot';
    const isCustom = end.mode === 'custom';
    this.boxEndCustomFields.style.display = isCustom ? 'flex' : 'none';

    const yawVal = end.yaw !== undefined ? end.yaw : (toHotspot?.rotation?.y || 0);
    const pitchVal = end.pitch !== undefined ? end.pitch : (toHotspot?.rotation?.x || 0);
    const rollVal = end.roll !== undefined ? end.roll : (toHotspot?.rotation?.z || 0);

    this.inputEndYaw.value = String(MathUtils.round(yawVal, 1));
    this.inputEndPitch.value = String(MathUtils.round(pitchVal, 1));
    this.inputEndRoll.value = String(MathUtils.round(rollVal, 1));

    const transDur = end.transitionDuration !== undefined ? end.transitionDuration : 2.0;
    this.sliderEndTransition.value = String(transDur);
    this.valEndTransition.textContent = `${transDur}s`;
    this.selectEndEasing.value = end.easing || 'easeInOut';

    this.isInternalUpdate = false;
  }

  public updateEndOrientationValues(yaw: number, pitch: number, roll: number = 0): void {
    this.isInternalUpdate = true;
    this.inputEndYaw.value = String(MathUtils.round(yaw, 1));
    this.inputEndPitch.value = String(MathUtils.round(pitch, 1));
    this.inputEndRoll.value = String(MathUtils.round(roll, 1));
    this.isInternalUpdate = false;
  }

  public updateEndTransformValues(
    pos: { x: number; y: number; z: number } | null,
    yaw: number,
    pitch: number,
    roll: number = 0
  ): void {
    this.isInternalUpdate = true;
    if (pos) {
      this.inputEndPosX.value = String(MathUtils.round(pos.x, 2));
      this.inputEndPosY.value = String(MathUtils.round(pos.y, 2));
      this.inputEndPosZ.value = String(MathUtils.round(pos.z, 2));
    }
    this.inputEndYaw.value = String(MathUtils.round(yaw, 1));
    this.inputEndPitch.value = String(MathUtils.round(pitch, 1));
    this.inputEndRoll.value = String(MathUtils.round(roll, 1));
    this.isInternalUpdate = false;
  }

  public setOnStartAlignEndOrientation(callback: () => void): void {
    this.onStartAlignEndOrientation = callback;
  }

  public setOnGetCurrentCameraTransform(
    callback: () => { position: { x: number; y: number; z: number }; yaw: number; pitch: number; roll: number }
  ): void {
    this.onGetCurrentCameraTransform = callback;
  }

  private renderWaypointFields(wp: CameraWaypoint): void {
    this.isInternalUpdate = true;
    this.inputWpName.value = wp.name;
    this.inputWpPosX.value = String(wp.position.x);
    this.inputWpPosY.value = String(wp.position.y);
    this.inputWpPosZ.value = String(wp.position.z);

    const mode = wp.orientation?.mode || 'followPath';
    this.selectOrientationMode.value = mode;
    this.rowManualAngles.style.display = mode === 'manual' ? 'grid' : 'none';

    this.inputWpYaw.value = String(wp.orientation?.yaw || 0);
    this.inputWpPitch.value = String(wp.orientation?.pitch || 0);
    this.inputWpDwell.value = String(wp.dwellTimeSeconds || 0);
    this.chkWpLocked.checked = wp.locked || false;

    this.isInternalUpdate = false;
  }
}
