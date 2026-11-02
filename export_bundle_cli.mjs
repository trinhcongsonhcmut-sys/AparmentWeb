// Mock FileReader for Node.js environment
global.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result =
        'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
};

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

async function bundleGlb() {
  const args = process.argv.slice(2);
  const glbPath = args[0] || 'modern_apartment.glb';
  const configPath = args[1] || 'sketchfab_modern_apartment_hotspots.json';
  const outputPath = args[2] || glbPath.replace(/\.[^/.]+$/, '') + '_bundled.glb';

  if (!fs.existsSync(glbPath)) {
    console.error(`❌ Không tìm thấy file mô hình GLB: "${glbPath}"`);
    process.exit(1);
  }
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Không tìm thấy file cấu hình JSON: "${configPath}"`);
    process.exit(1);
  }

  console.log(`📦 Đang đọc mô hình: ${glbPath}`);
  const glbBuffer = fs.readFileSync(glbPath);
  const arrayBuffer = glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength);
  const configContent = fs.readFileSync(configPath, 'utf8');
  const projectConfig = JSON.parse(configContent);

  console.log(`📋 Đã nạp cấu hình: ${projectConfig.hotspots?.length || 0} hotspots, ${projectConfig.waypoints?.length || 0} waypoints`);

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(arrayBuffer, '');
  const rootScene = gltf.scene || new THREE.Group();

  // Đóng gói cấu hình vào userData của Scene (hoặc extras trong chuẩn GLTF)
  rootScene.userData = {
    ...rootScene.userData,
    bahaProjectConfig: projectConfig,
  };

  console.log(`⚙️ Đang đóng gói dữ liệu vào file GLB duy nhất...`);
  const exporter = new GLTFExporter();
  exporter.parse(
    rootScene,
    (result) => {
      let outBuffer;
      if (result instanceof ArrayBuffer) {
        outBuffer = Buffer.from(result);
      } else {
        outBuffer = Buffer.from(JSON.stringify(result));
      }

      fs.writeFileSync(outputPath, outBuffer);
      console.log(`🎉 ĐÓNG GÓI THÀNH CÔNG!`);
      console.log(`   👉 File xuất: ${outputPath} (${Math.round(outBuffer.length / 1024)} KB)`);
      console.log(`   Dữ liệu cấu hình đã được nhúng vào: scene.userData.bahaProjectConfig`);
    },
    (err) => {
      console.error('❌ Lỗi đóng gói GLB:', err);
    },
    { binary: true }
  );
}

bundleGlb();
