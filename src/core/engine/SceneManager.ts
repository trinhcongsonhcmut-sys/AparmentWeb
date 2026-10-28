import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface SceneManagerOptions {
  canvasContainer: HTMLElement;
  css2dContainer: HTMLElement;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public css2dRenderer: CSS2DRenderer;

  public gridHelper: THREE.GridHelper;
  public axesHelper: THREE.AxesHelper;
  public currentModelGroup: THREE.Group;
  public hotspotLayerGroup: THREE.Group;

  private isRunning: boolean = false;
  private animFrameId: number = 0;
  private updateCallbacks: Array<(delta: number) => void> = [];
  private clock: THREE.Clock = new THREE.Clock();

  constructor(options: SceneManagerOptions) {
    const { canvasContainer, css2dContainer } = options;
    const width = canvasContainer.clientWidth || window.innerWidth;
    const height = canvasContainer.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1017);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(8, 6, 10);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasContainer.appendChild(this.renderer.domElement);

    // 4. CSS2D Renderer for sharp HTML Hotspot Badges
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(width, height);
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0px';
    this.css2dRenderer.domElement.style.left = '0px';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dContainer.appendChild(this.css2dRenderer.domElement);

    // 5. Lighting
    this.setupLighting();

    // 6. Helpers
    this.gridHelper = new THREE.GridHelper(30, 30, 0x00e5ff, 0x1f2638);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(2);
    this.axesHelper.position.y = 0.01;
    this.scene.add(this.axesHelper);

    // 7. Organization Groups
    this.currentModelGroup = new THREE.Group();
    this.currentModelGroup.name = 'CurrentModelContainer';
    this.scene.add(this.currentModelGroup);

    this.hotspotLayerGroup = new THREE.Group();
    this.hotspotLayerGroup.name = 'HotspotsContainer';
    this.scene.add(this.hotspotLayerGroup);

    // 8. Resize Listener
    window.addEventListener('resize', this.onResize);

    // 9. Start Loop
    this.start();
  }

  private setupLighting(): void {
    // Ambient / Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e2433, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Directional Key Light
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
    keyLight.position.set(15, 25, 20);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 100;
    keyLight.shadow.bias = -0.0001;
    const d = 15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0x90b0e0, 0.8);
    fillLight.position.set(-15, 10, -15);
    this.scene.add(fillLight);
  }

  public setGridVisible(visible: boolean): void {
    this.gridHelper.visible = visible;
    this.axesHelper.visible = visible;
  }

  public onResize = (): void => {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.css2dRenderer.setSize(width, height);
  };

  public addUpdateCallback(fn: (delta: number) => void): void {
    this.updateCallbacks.push(fn);
  }

  public removeUpdateCallback(fn: (delta: number) => void): void {
    this.updateCallbacks = this.updateCallbacks.filter((cb) => cb !== fn);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private animate = (): void => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    for (let i = 0; i < this.updateCallbacks.length; i++) {
      this.updateCallbacks[i](delta);
    }

    this.renderer.render(this.scene, this.camera);
    this.css2dRenderer.render(this.scene, this.camera);
  };

  public clearCurrentModel(): void {
    while (this.currentModelGroup.children.length > 0) {
      const child = this.currentModelGroup.children[0];
      this.currentModelGroup.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => this.disposeMaterial(m));
          } else {
            this.disposeMaterial(mesh.material);
          }
        }
      }
    });
  }

  private disposeMaterial(mat: THREE.Material): void {
    mat.dispose();
    for (const key of Object.keys(mat)) {
      const val = (mat as any)[key];
      if (val && typeof val === 'object' && val.isTexture) {
        val.dispose();
      }
    }
  }
}
