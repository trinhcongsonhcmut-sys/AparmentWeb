import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { ModelFingerprint } from './ModelFingerprint';
import { ModelInfoMeta } from '../../modules/config/types/config.types';

export interface LoadedModelResult {
  model: THREE.Group;
  meta: ModelInfoMeta;
  box: THREE.Box3;
  warnings: string[];
}

export type ProgressCallback = (percent: number, message: string) => void;

export class ModelLoaderService {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private usdzLoader: USDZLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    this.usdzLoader = new USDZLoader();
  }

  public async loadFromFile(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<LoadedModelResult> {
    const ext = this.getFileExtension(file.name);
    const buffer = await file.arrayBuffer();

    return this.loadFromArrayBuffer(buffer, file.name, file.size, ext, onProgress);
  }

  public async loadFromUrl(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<LoadedModelResult> {
    onProgress?.(10, 'Đang tải file từ đường dẫn...');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Không thể tải file từ URL: ${response.statusText} (${response.status})`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    let buffer: ArrayBuffer;
    if (totalBytes > 0 && response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const pct = Math.min(Math.round((receivedBytes / totalBytes) * 70) + 10, 80);
        onProgress?.(pct, `Đang tải: ${Math.round((receivedBytes / 1024 / 1024) * 10) / 10} MB`);
      }

      const allChunks = new Uint8Array(receivedBytes);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      buffer = allChunks.buffer;
    } else {
      buffer = await response.arrayBuffer();
    }

    const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'model.glb';
    const ext = this.getFileExtension(fileName);

    return this.loadFromArrayBuffer(buffer, fileName, buffer.byteLength, ext, onProgress);
  }

  public async loadFromArrayBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    fileSize: number,
    ext: 'glb' | 'gltf' | 'usdz' | 'unknown',
    onProgress?: ProgressCallback
  ): Promise<LoadedModelResult> {
    const warnings: string[] = [];

    onProgress?.(85, 'Đang giải mã hình học và vật liệu 3D...');

    let loadedObject: THREE.Group;

    if (ext === 'glb' || ext === 'gltf') {
      try {
        const gltf = await this.gltfLoader.parseAsync(buffer, '');
        loadedObject = gltf.scene || new THREE.Group();
      } catch (err: any) {
        throw new Error(`Lỗi phân tích file GLTF/GLB: ${err?.message || err}`);
      }
    } else if (ext === 'usdz') {
      try {
        onProgress?.(88, 'Đang xử lý cấu trúc USDZ...');
        loadedObject = (await this.usdzLoader.parse(buffer)) as THREE.Group;
        warnings.push(
          'Lưu ý: USDZ được hỗ trợ cơ bản. Một số vật liệu nâng cao có thể được hiển thị theo tiêu chuẩn phong.'
        );
      } catch (err: any) {
        throw new Error(
          `Lỗi nạp file USDZ: ${err?.message || err}. Khuyến nghị chuyển đổi sang .glb để tối ưu hiển thị.`
        );
      }
    } else {
      throw new Error(`Định dạng file không được hỗ trợ: .${ext}. Vui lòng dùng .glb hoặc .usdz`);
    }

    onProgress?.(95, 'Tính toán khung nhìn và bóng đổ...');

    // Enable shadows on meshes without altering their geometry/transforms
    loadedObject.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Compute bounding box strictly without modifying model position/scale
    const box = new THREE.Box3().setFromObject(loadedObject);

    // Compute fingerprint
    const meta = ModelFingerprint.compute(loadedObject, {
      name: fileName,
      size: fileSize,
      format: ext,
    });

    onProgress?.(100, 'Tải hoàn tất!');

    return {
      model: loadedObject,
      meta,
      box,
      warnings,
    };
  }

  private getFileExtension(filename: string): 'glb' | 'gltf' | 'usdz' | 'unknown' {
    const parts = filename.toLowerCase().split('.');
    const ext = parts[parts.length - 1];
    if (ext === 'glb') return 'glb';
    if (ext === 'gltf') return 'gltf';
    if (ext === 'usdz') return 'usdz';
    return 'unknown';
  }
}
