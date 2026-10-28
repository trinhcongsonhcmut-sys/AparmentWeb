import { ProjectConfigSchema, ModelInfoMeta } from '../types/config.types';
import { HotspotStore } from '../../hotspots/store/HotspotStore';
import { CameraPathStore } from '../../camera-path/store/CameraPathStore';
import { ModelFingerprint } from '../../../core/loaders/ModelFingerprint';
import { MathUtils } from '../../../shared/math/MathUtils';

export interface ImportValidationResult {
  valid: boolean;
  isModelCompatible: boolean;
  config?: ProjectConfigSchema;
  error?: string;
  warning?: string;
}

export class ConfigStorageService {
  private static readonly STORAGE_KEY_PREFIX = 'baha_3d_hotspot_editor_';

  public static exportToJson(
    store: HotspotStore,
    modelMeta: ModelInfoMeta,
    pathStore?: CameraPathStore,
    projectName: string = 'Dự án Căn hộ 3D'
  ): string {
    const config: ProjectConfigSchema = {
      schemaVersion: '1.0.0',
      projectId: MathUtils.simpleHash(modelMeta.fingerprint),
      projectName,
      updatedAt: new Date().toISOString(),
      modelInfo: modelMeta,
      hotspots: store.getAll(),
      waypoints: pathStore ? pathStore.getAllWaypoints() : [],
      cameraPaths: pathStore ? pathStore.getAllPaths() : [],
      settings: {
        markerOcclusion: false,
        showLabels: true,
        showIndexes: true,
        gridVisible: true,
      },
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(config, null, 2);
  }

  public static validateAndParse(
    jsonString: string,
    currentModelMeta?: ModelInfoMeta
  ): ImportValidationResult {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e: any) {
      return {
        valid: false,
        isModelCompatible: false,
        error: `File JSON bị lỗi cú pháp: ${e.message}`,
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, isModelCompatible: false, error: 'Dữ liệu JSON không hợp lệ.' };
    }

    if (!parsed.schemaVersion || !parsed.hotspots || !Array.isArray(parsed.hotspots)) {
      return {
        valid: false,
        isModelCompatible: false,
        error: 'File không đúng định dạng schema cấu hình Hotspot Studio (thiếu schemaVersion hoặc hotspots).',
      };
    }

    // Validate hotspot items
    for (let i = 0; i < parsed.hotspots.length; i++) {
      const h = parsed.hotspots[i];
      if (!h.id || !h.name || !h.position || typeof h.position.x !== 'number') {
        return {
          valid: false,
          isModelCompatible: false,
          error: `Mục hotspot thứ ${i + 1} (${h.name || 'chưa đặt tên'}) bị thiếu ID hoặc tọa độ hợp lệ.`,
        };
      }
    }

    let isCompatible = true;
    let warning: string | undefined;

    if (currentModelMeta && parsed.modelInfo) {
      isCompatible = ModelFingerprint.isCompatible(currentModelMeta, parsed.modelInfo);
      if (!isCompatible) {
        warning = `Cảnh báo: Cấu hình này thuộc về mô hình "${parsed.modelInfo.fileName || 'khác'}" (Fingerprint: ${parsed.modelInfo.fingerprint}), khác với mô hình hiện tại ("${currentModelMeta.fileName}", Fingerprint: ${currentModelMeta.fingerprint}). Tọa độ điểm có thể không khớp chính xác.`;
      }
    }

    return {
      valid: true,
      isModelCompatible: isCompatible,
      config: parsed as ProjectConfigSchema,
      warning,
    };
  }

  public static saveToLocalStorage(
    store: HotspotStore,
    modelMeta: ModelInfoMeta,
    pathStore?: CameraPathStore
  ): void {
    try {
      const json = this.exportToJson(store, modelMeta, pathStore);
      const key = `${this.STORAGE_KEY_PREFIX}${modelMeta.fingerprint}`;
      localStorage.setItem(key, json);
      // Also save last active key
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}last_active_key`, key);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public static loadFromLocalStorage(modelFingerprint: string): ProjectConfigSchema | null {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${modelFingerprint}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const res = this.validateAndParse(raw);
        if (res.valid && res.config) {
          return res.config;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
    return null;
  }
}
