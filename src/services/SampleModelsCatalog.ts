import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class SampleModelsCatalog {
  private static exporter = new GLTFExporter();

  /**
   * Generates a realistic modern apartment model with candidate nodes:
   * Living Room, Kitchen/Dining, Master Bedroom, and Balcony Camera.
   */
  public static async createModernApartmentGlb(): Promise<{ buffer: ArrayBuffer; name: string }> {
    const root = new THREE.Group();
    root.name = 'ModernApartmentScene';

    // Materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8a7058, // warm wood parquet
      roughness: 0.4,
      metalness: 0.05,
    });

    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xd0d5dd, // bright marble tile
      roughness: 0.2,
      metalness: 0.1,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6, // off-white architectural paint
      roughness: 0.8,
    });

    const sofaMat = new THREE.MeshStandardMaterial({
      color: 0x243242, // navy modern fabric
      roughness: 0.9,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3e28, // walnut
      roughness: 0.6,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.4,
    });

    // 1. FLOOR PLAN
    // Living room floor
    const livingFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 6), floorMat);
    livingFloor.position.set(0, -0.1, 0);
    livingFloor.name = 'Mesh_Floor_Living';
    root.add(livingFloor);

    // Kitchen floor (tile)
    const kitchenFloor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 6), tileMat);
    kitchenFloor.position.set(6, -0.1, 0);
    kitchenFloor.name = 'Mesh_Floor_Kitchen';
    root.add(kitchenFloor);

    // Bedroom floor
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), floorMat);
    bedFloor.position.set(0, -0.1, 5.5);
    bedFloor.name = 'Mesh_Floor_Bedroom';
    root.add(bedFloor);

    // Balcony floor
    const balcFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 2), tileMat);
    balcFloor.position.set(0, -0.125, -4);
    balcFloor.name = 'Mesh_Floor_Balcony';
    root.add(balcFloor);

    // 2. WALLS
    // Back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 0.2), wallMat);
    backWall.position.set(2.5, 1.5, 8);
    backWall.name = 'Mesh_Wall_Back';
    root.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 14), wallMat);
    leftWall.position.set(-3.5, 1.5, 1);
    leftWall.name = 'Mesh_Wall_Left';
    root.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 14), wallMat);
    rightWall.position.set(8.5, 1.5, 1);
    rightWall.name = 'Mesh_Wall_Right';
    root.add(rightWall);

    // Partition wall between Living and Bedroom
    const partWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 0.2), wallMat);
    partWall.position.set(-1.25, 1.5, 3);
    partWall.name = 'Mesh_Wall_Partition';
    root.add(partWall);

    // Glass Balcony Door
    const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 0.05), glassMat);
    glassDoor.position.set(0, 1.4, -3);
    glassDoor.name = 'Mesh_Glass_Balcony_Door';
    root.add(glassDoor);

    // Balcony Railing
    const balcRail = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 0.05), glassMat);
    balcRail.position.set(0, 0.55, -5);
    balcRail.name = 'Mesh_Balcony_Railing';
    root.add(balcRail);

    // 3. FURNITURE
    // Sofa in Living Room
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(3, 0.45, 1.2), sofaMat);
    sofaBase.position.set(0, 0.225, 0.5);
    sofaBase.name = 'Mesh_Sofa_Base';
    root.add(sofaBase);

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.3), sofaMat);
    sofaBack.position.set(0, 0.6, 1.05);
    sofaBack.name = 'Mesh_Sofa_Back';
    root.add(sofaBack);

    // Coffee table
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.8), woodMat);
    table.position.set(0, 0.175, -0.6);
    table.name = 'Mesh_Coffee_Table';
    root.add(table);

    // Kitchen Counter Island
    const kitchenIsland = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.1), woodMat);
    kitchenIsland.position.set(5.5, 0.45, 0);
    kitchenIsland.name = 'Mesh_Kitchen_Island';
    root.add(kitchenIsland);

    // Bed in bedroom
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.2), sofaMat);
    bed.position.set(0, 0.25, 5.5);
    bed.name = 'Mesh_Master_Bed';
    root.add(bed);

    // 4. CANDIDATE HOTSPOT OBJECTS (Embedded in hierarchy to test auto-detection!)
    // Candidate 1: Living Room Hotspot (Empty node matching keyword)
    const candLiving = new THREE.Object3D();
    candLiving.name = 'hotspot_phong_khach';
    candLiving.position.set(0, 1.2, 0);
    candLiving.userData = { isHotspot: true, title: 'Phòng khách trung tâm' };
    root.add(candLiving);

    // Candidate 2: Kitchen Hotspot
    const candKitchen = new THREE.Object3D();
    candKitchen.name = 'hotspot_khu_bep_an';
    candKitchen.position.set(5.5, 1.2, 0);
    candKitchen.userData = { isHotspot: true, title: 'Khu vực Bếp & Bàn ăn' };
    root.add(candKitchen);

    // Candidate 3: Master Bedroom Hotspot
    const candBed = new THREE.Object3D();
    candBed.name = 'hotspot_phong_ngu_master';
    candBed.position.set(0, 1.2, 5.5);
    candBed.userData = { isHotspot: true, title: 'Phòng ngủ Master' };
    root.add(candBed);

    // Candidate 4: Balcony Camera (Camera node)
    const candCamBalc = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    candCamBalc.name = 'cam_goc_nhin_ban_cong';
    candCamBalc.position.set(0, 1.4, -4);
    candCamBalc.lookAt(0, 1.4, 0);
    root.add(candCamBalc);

    // Export to GLB ArrayBuffer
    const buffer = await this.exportGlb(root);
    return { buffer, name: 'modern_apartment.glb' };
  }

  /**
   * Generates a clean modern townhouse without predefined hotspots for manual placement testing.
   */
  public static async createTownhouseCleanGlb(): Promise<{ buffer: ArrayBuffer; name: string }> {
    const root = new THREE.Group();
    root.name = 'TownhouseArchitectureScene';

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      roughness: 0.7,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });
    const woodLouverMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.6,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.5,
    });

    // Ground platform & driveway
    const ground = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 14), concreteMat);
    ground.position.set(0, -0.15, 0);
    ground.name = 'Mesh_Driveway_Courtyard';
    root.add(ground);

    // Ground floor volume
    const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 10), whiteMat);
    groundFloor.position.set(0, 1.6, 1);
    groundFloor.name = 'Mesh_Ground_Floor';
    root.add(groundFloor);

    // First floor cantilevered volume
    const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.4, 9), whiteMat);
    upperFloor.position.set(0, 4.9, 0.5);
    upperFloor.name = 'Mesh_Upper_Floor_Volume';
    root.add(upperFloor);

    // Architectural Wood Louver Facade
    const louvers = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 0.15), woodLouverMat);
    louvers.position.set(2, 4.9, -4.05);
    louvers.name = 'Mesh_Wood_Louvers';
    root.add(louvers);

    // Large Ribbon Window
    const ribbonWindow = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.1), glassMat);
    ribbonWindow.position.set(-1.8, 4.9, -4.05);
    ribbonWindow.name = 'Mesh_Ribbon_Window';
    root.add(ribbonWindow);

    // Entrance Glass Door
    const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.1), glassMat);
    mainDoor.position.set(0, 1.3, -4.05);
    mainDoor.name = 'Mesh_Entrance_Door';
    root.add(mainDoor);

    const buffer = await this.exportGlb(root);
    return { buffer, name: 'townhouse_clean.glb' };
  }

  private static exportGlb(root: THREE.Group): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        root,
        (gltf) => {
          if (gltf instanceof ArrayBuffer) {
            resolve(gltf);
          } else {
            const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
            blob.arrayBuffer().then(resolve).catch(reject);
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });
  }
}
