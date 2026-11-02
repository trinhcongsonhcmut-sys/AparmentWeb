import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { HotspotMarker2D } from '../src/modules/hotspots/components/HotspotMarker2D.ts';
import { CameraPathfindingService } from '../src/modules/camera-path/services/CameraPathfindingService.ts';
import { SmoothRotationService } from '../src/modules/camera-path/services/SmoothRotationService.ts';
import { PathTrajectoryEvaluator } from '../src/modules/camera-path/services/PathTrajectoryEvaluator.ts';
import { CameraNavigator } from '../src/core/navigation/CameraNavigator.ts';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

test('Verification: HotspotMarker2D freshness, Pathfinding target orientation & smooth arrival', async (t) => {
  const smoothService = SmoothRotationService.getInstance();
  const pathfinding = new CameraPathfindingService();

  // Mock DOM
  globalThis.window = {
    addEventListener: () => { },
    removeEventListener: () => { }
  };
  globalThis.document = {
    createElement: () => ({
      className: '',
      dataset: {},
      style: {},
      appendChild: () => { },
      addEventListener: () => { },
      classList: { add: () => { }, remove: () => { } },
      setAttribute: () => { },
      removeAttribute: () => { }
    }),
    addEventListener: () => { },
    removeEventListener: () => { }
  };

  const domElement = {
    style: {},
    addEventListener: () => { },
    removeEventListener: () => { },
    ownerDocument: globalThis.document,
    getRootNode: () => globalThis.document,
    clientWidth: 1920,
    clientHeight: 1080
  };

  await t.test('1. HotspotMarker2D updates internal hotspot reference on updateFromItem', () => {
    const initialHotspot = {
      id: 'h2',
      name: 'Điểm số 2',
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: 0, y: 0, z: 0 },
      cameraView: { configured: false, yaw: 0, pitch: 0, roll: 0 },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let clickedHotspot = null;
    const marker = new HotspotMarker2D(initialHotspot, (item) => {
      clickedHotspot = item;
    });

    assert.strictEqual(marker.hotspot.cameraView.configured, false);

    // User configures destination orientation and position
    const updatedHotspot = {
      ...initialHotspot,
      cameraView: {
        configured: true,
        useCustomPosition: true,
        cameraPosition: { x: 4.8, y: 1.6, z: 4.8 },
        yaw: 55,
        pitch: -1,
        roll: 0,
      },
      rotation: { x: -1, y: 55, z: 0 },
      updatedAt: new Date().toISOString(),
    };

    marker.updateFromItem(updatedHotspot, 2);

    // Verify marker.hotspot is updated immediately
    assert.strictEqual(marker.hotspot.cameraView.configured, true);
    assert.strictEqual(marker.hotspot.cameraView.yaw, 55);
    assert.strictEqual(marker.hotspot.cameraView.pitch, -1);
    assert.strictEqual(marker.hotspot.cameraView.cameraPosition.x, 4.8);

    // Simulate click
    marker['onSelectCallback'](marker.hotspot);
    assert.notStrictEqual(clickedHotspot, null);
    assert.strictEqual(clickedHotspot.cameraView.configured, true);
    assert.strictEqual(clickedHotspot.cameraView.yaw, 55);
    assert.strictEqual(clickedHotspot.cameraView.pitch, -1);
  });

  await t.test('2. CameraPathfindingService resolves fresh hotspot orientation from store', () => {
    const freshHotspot = {
      id: 'h2',
      name: 'Điểm số 2',
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: -1, y: 55, z: 0 },
      cameraView: {
        configured: true,
        useCustomPosition: true,
        cameraPosition: { x: 4.8, y: 1.6, z: 4.8 },
        yaw: 55,
        pitch: -1,
        roll: 0,
      },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: '',
      updatedAt: '',
    };

    // Even if a caller accidentally passes a stale object without configured cameraView
    const staleHotspot = {
      id: 'h2',
      name: 'Điểm số 2',
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: 0, y: 0, z: 0 },
      cameraView: { configured: false, yaw: 0, pitch: 0, roll: 0 },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: '',
      updatedAt: '',
    };

    const cameraPos = new THREE.Vector3(0, 1.6, 0);
    const cameraQuat = smoothService.eulerToQuaternion(0, 0, 0);
    const sceneRoot = new THREE.Object3D();

    const result = pathfinding.findOptimalRoute(
      cameraPos,
      cameraQuat,
      staleHotspot,
      [freshHotspot], // Fresh store array
      [],
      [],
      sceneRoot,
      []
    );

    assert.strictEqual(result.success, true);
    assert.notStrictEqual(result.targetQuaternion, null);

    const targetEuler = smoothService.quaternionToEuler(result.targetQuaternion);
    assert.strictEqual(targetEuler.yaw, 55);
    assert.strictEqual(targetEuler.pitch, -1);
    assert.strictEqual(result.targetPosition.x, 4.8);
    assert.strictEqual(result.targetPosition.y, 1.6);
    assert.strictEqual(result.targetPosition.z, 4.8);
  });

  await t.test('3. CameraNavigator navigates along waypoints and arrives at exact Yaw 55°, Pitch -1°', () => {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    cam.position.set(0, 1.6, 0);
    cam.quaternion.copy(smoothService.eulerToQuaternion(0, 0, 0));

    const controls = new OrbitControls(cam, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const nav = new CameraNavigator(cam, controls, new THREE.Object3D());

    const destHotspot = {
      id: 'h2',
      name: 'Điểm số 2',
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: -1, y: 55, z: 0 },
      cameraView: {
        configured: true,
        useCustomPosition: true,
        cameraPosition: { x: 4.8, y: 1.6, z: 4.8 },
        yaw: 55,
        pitch: -1,
        roll: 0,
      },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: '',
      updatedAt: '',
    };

    const wp1 = {
      id: 'wp1',
      name: 'Điểm rẽ P1',
      position: { x: 2.5, y: 1.6, z: 2.5 },
      orientation: { mode: 'followPath' },
    };

    const edge1 = { id: 'e1', fromWaypointId: 'wp1', toWaypointId: 'h2', bidirectional: true, status: 'valid' };

    const success = nav.navigateToHotspot(
      destHotspot,
      [destHotspot],
      [wp1],
      [],
      [edge1]
    );

    assert.strictEqual(success, true);
    assert.strictEqual(nav.isNavigating(), true);

    // Simulate flight through full duration
    const stepDelta = 0.05;
    for (let t = 0; t <= 6.0; t += stepDelta) {
      nav.update(stepDelta);
      if (!nav.isNavigating()) break;
    }

    assert.strictEqual(nav.isNavigating(), false);

    // Verify final arrival position
    assert.strictEqual(Math.abs(cam.position.x - 4.8) < 0.01, true);
    assert.strictEqual(Math.abs(cam.position.y - 1.6) < 0.01, true);
    assert.strictEqual(Math.abs(cam.position.z - 4.8) < 0.01, true);

    // Verify final arrival orientation (Exact Yaw 55°, Pitch -1°)
    const finalEuler = smoothService.quaternionToEuler(cam.quaternion);
    assert.strictEqual(finalEuler.yaw, 55);
    assert.strictEqual(finalEuler.pitch, -1);
    assert.strictEqual(finalEuler.roll, 0);

    // Verify controls target is aligned along forward direction and controls are enabled
    assert.strictEqual(controls.enabled, true);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const expectedTarget = cam.position.clone().addScaledVector(fwd, 5.0);
    assert.strictEqual(controls.target.distanceTo(expectedTarget) < 0.01, true);
  });

  await t.test('4. PathTrajectoryEvaluator evaluates exact end transform for Camera Path', () => {
    const evaluator = new PathTrajectoryEvaluator();

    const h1 = {
      id: 'h1',
      name: 'Điểm số 1',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      cameraView: { configured: true, useCustomPosition: true, cameraPosition: { x: 0, y: 1.6, z: 0 }, yaw: 0, pitch: 0, roll: 0 },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: '',
      updatedAt: '',
    };

    const h2 = {
      id: 'h2',
      name: 'Điểm số 2',
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: -1, y: 55, z: 0 },
      cameraView: {
        configured: true,
        useCustomPosition: true,
        cameraPosition: { x: 4.8, y: 1.6, z: 4.8 },
        yaw: 55,
        pitch: -1,
        roll: 0,
      },
      marker: { type: '2d', color: '#00e5ff', size: 1, showBadge: true, icon: '' },
      visible: true,
      locked: false,
      createdAt: '',
      updatedAt: '',
    };

    const path = {
      id: 'p1',
      name: 'Tuyến Điểm 1 -> Điểm 2',
      fromHotspotId: 'h1',
      toHotspotId: 'h2',
      curveType: 'spline',
      tension: 0.5,
      durationSeconds: 4,
      easing: 'easeInOut',
    };

    const wp1 = {
      id: 'wp1',
      name: 'P1',
      position: { x: 2.5, y: 1.6, z: 2.5 },
      orientation: { mode: 'followPath' },
    };

    evaluator.buildTrajectory(path, [wp1], h1, h2);

    const endTransform = evaluator.evaluateAt(1.0, path);
    assert.notStrictEqual(endTransform, null);

    assert.strictEqual(endTransform.position.x, 4.8);
    assert.strictEqual(endTransform.position.y, 1.6);
    assert.strictEqual(endTransform.position.z, 4.8);

    const quat = new THREE.Quaternion(endTransform.quaternion.x, endTransform.quaternion.y, endTransform.quaternion.z, endTransform.quaternion.w);
    const euler = smoothService.quaternionToEuler(quat);
    assert.strictEqual(euler.yaw, 55);
    assert.strictEqual(euler.pitch, -1);
  });
});
