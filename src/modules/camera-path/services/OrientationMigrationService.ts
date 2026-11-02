import type { HotspotItem, Vector3D } from '../../hotspots/types/hotspot.types';
import type { CameraPath } from '../types/cameraPath.types';
import type { ProjectConfigSchema } from '../../config/types/config.types';

export interface ConflictingPathInfo {
  pathId: string;
  pathName: string;
  yaw: number;
  pitch: number;
  roll?: number;
  position?: Vector3D;
  useCustomPosition?: boolean;
}

export interface OrientationConflict {
  hotspotId: string;
  hotspotName: string;
  conflictingPaths: ConflictingPathInfo[];
}

export interface MigrationResult {
  success: boolean;
  schemaVersion: '1.2.0';
  migratedHotspotCount: number;
  conflicts: OrientationConflict[];
  summary: string;
}

export class OrientationMigrationService {
  /**
   * Scans paths and hotspots to detect any cases where multiple CameraPaths leading to the same
   * destination Hotspot have differing end orientations or end positions.
   */
  public static detectConflicts(
    hotspots: HotspotItem[],
    paths: CameraPath[]
  ): OrientationConflict[] {
    const conflicts: OrientationConflict[] = [];
    const hotspotMap = new Map<string, HotspotItem>();
    hotspots.forEach((h) => hotspotMap.set(h.id, h));

    // Group paths by toHotspotId
    const pathsByDest = new Map<string, CameraPath[]>();
    for (const path of paths) {
      if (!path.toHotspotId) continue;
      const list = pathsByDest.get(path.toHotspotId) || [];
      list.push(path);
      pathsByDest.set(path.toHotspotId, list);
    }

    for (const [hotspotId, destPaths] of pathsByDest.entries()) {
      const hotspot = hotspotMap.get(hotspotId);
      const hotspotName = hotspot?.name || `Hotspot ${hotspotId}`;

      // Collect paths with explicit custom end orientation or custom end position
      const configuredPaths: ConflictingPathInfo[] = [];

      for (const p of destPaths) {
        const hasCustomOrient =
          p.endOrientation &&
          p.endOrientation.mode === 'custom' &&
          p.endOrientation.yaw !== undefined;

        const hasCustomPos = Boolean(
          (p.useCustomEndPosition || p.endOrientation?.useCustomPosition) &&
            (p.endPosition || p.endOrientation?.position)
        );

        if (hasCustomOrient || hasCustomPos) {
          configuredPaths.push({
            pathId: p.id,
            pathName: p.name,
            yaw: Math.round((p.endOrientation?.yaw ?? 0) * 10) / 10,
            pitch: Math.round((p.endOrientation?.pitch ?? 0) * 10) / 10,
            roll: Math.round((p.endOrientation?.roll ?? 0) * 10) / 10,
            position: p.endPosition || p.endOrientation?.position,
            useCustomPosition: hasCustomPos,
          });
        }
      }

      if (configuredPaths.length <= 1) {
        continue;
      }

      // Check if any two paths differ significantly in Yaw (> 2°), Pitch (> 2°), or Position (> 0.1m)
      const first = configuredPaths[0];
      let hasDiscrepancy = false;

      for (let i = 1; i < configuredPaths.length; i++) {
        const other = configuredPaths[i];
        const yawDiff = Math.abs(first.yaw - other.yaw);
        const pitchDiff = Math.abs(first.pitch - other.pitch);

        if (yawDiff > 2.0 || pitchDiff > 2.0) {
          hasDiscrepancy = true;
          break;
        }

        if (first.useCustomPosition !== other.useCustomPosition) {
          hasDiscrepancy = true;
          break;
        }

        if (first.position && other.position) {
          const dx = first.position.x - other.position.x;
          const dy = first.position.y - other.position.y;
          const dz = first.position.z - other.position.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.1) {
            hasDiscrepancy = true;
            break;
          }
        }
      }

      if (hasDiscrepancy) {
        conflicts.push({
          hotspotId,
          hotspotName,
          conflictingPaths: configuredPaths,
        });
      }
    }

    return conflicts;
  }

  /**
   * Migrates a ProjectConfigSchema from v1.0.0 / v1.1.0 to v1.2.0.
   * Transfers destination orientations and camera positions from CameraPaths into their destination Hotspots.
   * If conflicts are detected, keeps those hotspots unoverwritten and reports them in the result.
   */
  public static migrateConfig(config: ProjectConfigSchema): {
    migratedConfig: ProjectConfigSchema;
    result: MigrationResult;
  } {
    const hotspots = (config.hotspots || []).map((h) => ({ ...h }));
    const paths = config.cameraPaths || [];
    const conflicts = this.detectConflicts(hotspots, paths);
    const conflictingHotspotIds = new Set(conflicts.map((c) => c.hotspotId));

    let migratedHotspotCount = 0;

    // Map paths by destination hotspot
    const pathsByDest = new Map<string, CameraPath[]>();
    for (const p of paths) {
      if (!p.toHotspotId) continue;
      const list = pathsByDest.get(p.toHotspotId) || [];
      list.push(p);
      pathsByDest.set(p.toHotspotId, list);
    }

    for (let i = 0; i < hotspots.length; i++) {
      const h = hotspots[i];

      // If already has configured cameraView, keep it
      if (h.cameraView?.configured) {
        continue;
      }

      // If this hotspot has conflicting paths, do NOT guess. Wait for admin resolution.
      if (conflictingHotspotIds.has(h.id)) {
        continue;
      }

      const incomingPaths = pathsByDest.get(h.id) || [];
      // Find any path that has custom end orientation or position
      const candidatePath = incomingPaths.find(
        (p) =>
          (p.endOrientation && p.endOrientation.mode === 'custom' && p.endOrientation.yaw !== undefined) ||
          ((p.useCustomEndPosition || p.endOrientation?.useCustomPosition) && (p.endPosition || p.endOrientation?.position))
      );

      if (candidatePath) {
        const yaw = candidatePath.endOrientation?.yaw ?? (h.rotation?.y || 0);
        const pitch = candidatePath.endOrientation?.pitch ?? (h.rotation?.x || 0);
        const roll = candidatePath.endOrientation?.roll ?? (h.rotation?.z || 0);
        const hasCustomPos = Boolean(
          (candidatePath.useCustomEndPosition || candidatePath.endOrientation?.useCustomPosition) &&
            (candidatePath.endPosition || candidatePath.endOrientation?.position)
        );
        const camPos = hasCustomPos
          ? (candidatePath.endPosition || candidatePath.endOrientation?.position)
          : undefined;

        h.cameraView = {
          configured: true,
          useCustomPosition: hasCustomPos,
          cameraPosition: camPos,
          yaw: Math.round(yaw * 10) / 10,
          pitch: Math.round(pitch * 10) / 10,
          roll: Math.round(roll * 10) / 10,
        };

        // Synchronize rotation field
        h.rotation = {
          x: h.cameraView.pitch,
          y: h.cameraView.yaw,
          z: h.cameraView.roll,
        };

        migratedHotspotCount++;
      } else if (h.rotation && (h.rotation.x !== 0 || h.rotation.y !== 0)) {
        // Hotspot had non-zero rotation manually specified in older config
        h.cameraView = {
          configured: true,
          useCustomPosition: false,
          yaw: h.rotation.y,
          pitch: h.rotation.x,
          roll: h.rotation.z || 0,
        };
        migratedHotspotCount++;
      } else {
        // Unconfigured hotspot: mark explicitly as unconfigured
        h.cameraView = {
          configured: false,
          useCustomPosition: false,
          yaw: 0,
          pitch: 0,
          roll: 0,
        };
      }
    }

    const migratedConfig: ProjectConfigSchema = {
      ...config,
      schemaVersion: '1.2.0',
      hotspots,
      updatedAt: new Date().toISOString(),
    };

    const summary = conflicts.length > 0
      ? `Đã di chuyển thành công ${migratedHotspotCount} Hotspot lên Schema v1.2.0. Phát hiện ${conflicts.length} Hotspot có xung đột góc nhìn giữa các tuyến cần xác nhận.`
      : `Đã di chuyển thành công ${migratedHotspotCount} Hotspot lên Schema v1.2.0. Toàn bộ các tuyến đã được thống nhất hướng nhìn tại Hotspot đích!`;

    return {
      migratedConfig,
      result: {
        success: true,
        schemaVersion: '1.2.0',
        migratedHotspotCount,
        conflicts,
        summary,
      },
    };
  }

  /**
   * Applies an administrator's choice to resolve a conflict for a specific hotspot.
   */
  public static resolveConflict(
    hotspot: HotspotItem,
    chosenOrientation: {
      yaw: number;
      pitch: number;
      roll?: number;
      useCustomPosition?: boolean;
      cameraPosition?: Vector3D;
    }
  ): HotspotItem {
    return {
      ...hotspot,
      cameraView: {
        configured: true,
        useCustomPosition: chosenOrientation.useCustomPosition || false,
        cameraPosition: chosenOrientation.cameraPosition,
        yaw: chosenOrientation.yaw,
        pitch: chosenOrientation.pitch,
        roll: chosenOrientation.roll || 0,
      },
      rotation: {
        x: chosenOrientation.pitch,
        y: chosenOrientation.yaw,
        z: chosenOrientation.roll || 0,
      },
      updatedAt: new Date().toISOString(),
    };
  }
}
