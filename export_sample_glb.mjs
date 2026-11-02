global.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
};

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

async function exportGlb() {
  const root = new THREE.Group();
  root.name = 'ModernApartmentScene';

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a7058, roughness: 0.4, metalness: 0.05 });
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xd0d5dd, roughness: 0.2, metalness: 0.1 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.8 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x243242, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.4 });

  // Floors
  const livingFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 6), floorMat);
  livingFloor.position.set(0, -0.1, 0);
  root.add(livingFloor);

  const kitchenFloor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 6), tileMat);
  kitchenFloor.position.set(6, -0.1, 0);
  root.add(kitchenFloor);

  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), floorMat);
  bedFloor.position.set(0, -0.1, 5.5);
  root.add(bedFloor);

  const balcFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 2), tileMat);
  balcFloor.position.set(0, -0.125, -4);
  root.add(balcFloor);

  // Walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 0.2), wallMat);
  backWall.position.set(2.5, 1.5, 8);
  root.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 14), wallMat);
  leftWall.position.set(-3.5, 1.5, 1);
  root.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 14), wallMat);
  rightWall.position.set(8.5, 1.5, 1);
  root.add(rightWall);

  const partWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 0.2), wallMat);
  partWall.position.set(-1.25, 1.5, 3);
  root.add(partWall);

  // Furniture
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(3, 0.45, 1.2), sofaMat);
  sofaBase.position.set(0, 0.225, 0.5);
  root.add(sofaBase);

  const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.8), woodMat);
  table.position.set(0, 0.175, -0.6);
  root.add(table);

  const kitchenIsland = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.1), woodMat);
  kitchenIsland.position.set(5.5, 0.45, 0);
  root.add(kitchenIsland);

  const exporter = new GLTFExporter();
  exporter.parse(
    root,
    (gltf) => {
      const buffer = Buffer.from(gltf);
      const dir1 = 'Z:/01_du_an/PRJ_000_bahagroup_web_v2/03_ban_lam_viec/bahagroup_web_v2/public/models';
      const dir2 = 'Z:/01_du_an/PRJ_000_bahagroup_web_v2/03_ban_lam_viec/bahagroup_web_v2/out/models';
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'modern_apartment.glb'), buffer);
      fs.writeFileSync(path.join(dir2, 'modern_apartment.glb'), buffer);
      console.log('Successfully written modern_apartment.glb, size:', buffer.byteLength);
    },
    (err) => console.error(err),
    { binary: true }
  );
}

exportGlb();
