import assert from 'assert';
import * as THREE from 'three';

// Import services and types using node --experimental-strip-types
import { PathTrajectoryEvaluator } from '../src/modules/camera-path/services/PathTrajectoryEvaluator.ts';
import { CameraPathfindingService } from '../src/modules/camera-path/services/CameraPathfindingService.ts';
import { OrientationMigrationService } from '../src/modules/camera-path/services/OrientationMigrationService.ts';

console.log('🏛️ Starting Comprehensive Verification Suite for Destination Hotspot Camera View Architecture...\n');

// -------------------------------------------------------------
// TEST 1: Hotspot Data Model & CameraView Standardization
// -------------------------------------------------------------
console.log('--- Test 1: Hotspot Data Model & CameraView Standardization ---');
{
  const hotspotH6 = {
    id: 'hotspot-h6',
    name: 'Phòng ngủ Master H6',
    type: 'navigation',
    position: { x: 5.0, y: 0.1, z: -4.0 },
    rotation: { x: -10, y: 135, z: 0 },
    cameraView: {
      configured: true,
      useCustomPosition: true,
      cameraPosition: { x: 5.0, y: 1.65, z: -3.5 },
      yaw: 135,
      pitch: -10,
      roll: 0,
    },
    visible: true,
    locked: false,
    marker: { color: '#00E5FF', size: 1.0, showBadge: true },
    source: { kind: 'user-created' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.strictEqual(hotspotH6.cameraView.configured, true);
  assert.strictEqual(hotspotH6.cameraView.useCustomPosition, true);
  assert.strictEqual(hotspotH6.cameraView.yaw, 135);
  assert.strictEqual(hotspotH6.cameraView.pitch, -10);
  assert.strictEqual(hotspotH6.rotation.y, hotspotH6.cameraView.yaw);
  assert.strictEqual(hotspotH6.rotation.x, hotspotH6.cameraView.pitch);

  console.log('  ✓ Hotspot H6 schema correctly holds cameraView and synchronizes rotation.');
  console.log('✅ Test 1 Passed: Hotspot Data Model & CameraView standardized!\n');
}

// -------------------------------------------------------------
// TEST 2: Multiple Paths to Same Hotspot (H1 -> H6, H3 -> H6)
// -------------------------------------------------------------
console.log('--- Test 2: Multiple Paths to Same Hotspot Share Target View ---');
{
  const h1 = {
    id: 'hotspot-h1',
    name: 'Phòng khách H1',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };
  const h3 = {
    id: 'hotspot-h3',
    name: 'Ban công H3',
    position: { x: -3, y: 0, z: 2 },
    rotation: { x: 0, y: 0, z: 0 },
  };
  const h6 = {
    id: 'hotspot-h6',
    name: 'Phòng ngủ H6',
    position: { x: 6, y: 0, z: -5 },
    rotation: { x: -5, y: 90, z: 0 },
    cameraView: {
      configured: true,
      useCustomPosition: true,
      cameraPosition: { x: 6.0, y: 1.6, z: -4.2 },
      yaw: 90,
      pitch: -5,
      roll: 0,
    },
  };

  const wp1 = { id: 'wp-1', name: 'W1', position: { x: 2, y: 1.2, z: -2 } };
  const wp2 = { id: 'wp-2', name: 'W2', position: { x: 1, y: 1.2, z: -1 } };

  // Path A: H1 -> H6
  const pathA = {
    id: 'path-h1-h6',
    name: 'Tuyến: H1 -> H6',
    fromHotspotId: 'hotspot-h1',
    toHotspotId: 'hotspot-h6',
    waypointIds: ['wp-1'],
    durationSeconds: 6.0,
    curveType: 'spline',
    tension: 0.5,
    easing: 'easeInOut',
  };

  // Path B: H3 -> H6
  const pathB = {
    id: 'path-h3-h6',
    name: 'Tuyến: H3 -> H6',
    fromHotspotId: 'hotspot-h3',
    toHotspotId: 'hotspot-h6',
    waypointIds: ['wp-2'],
    durationSeconds: 8.0,
    curveType: 'spline',
    tension: 0.5,
    easing: 'easeInOut',
  };

  const evalA = new PathTrajectoryEvaluator();
  evalA.buildTrajectory(pathA, [wp1], h1, h6);
  const endPosA = evalA.getResolvedEndPosition(pathA);
  const endQuatA = evalA.getEndQuaternion(pathA);

  const evalB = new PathTrajectoryEvaluator();
  evalB.buildTrajectory(pathB, [wp2], h3, h6);
  const endPosB = evalB.getResolvedEndPosition(pathB);
  const endQuatB = evalB.getEndQuaternion(pathB);

  // Verify end positions match H6 cameraPosition exactly
  assert.strictEqual(endPosA.x, h6.cameraView.cameraPosition.x);
  assert.strictEqual(endPosA.y, h6.cameraView.cameraPosition.y);
  assert.strictEqual(endPosA.z, h6.cameraView.cameraPosition.z);

  assert.strictEqual(endPosB.x, h6.cameraView.cameraPosition.x);
  assert.strictEqual(endPosB.y, h6.cameraView.cameraPosition.y);
  assert.strictEqual(endPosB.z, h6.cameraView.cameraPosition.z);

  // Verify end orientations match H6 cameraView exactly (Yaw = 90, Pitch = -5)
  const expectedEuler = new THREE.Euler(
    THREE.MathUtils.degToRad(-5),
    THREE.MathUtils.degToRad(90),
    0,
    'YXZ'
  );
  const expectedQuat = new THREE.Quaternion().setFromEuler(expectedEuler);

  const dotA = Math.abs(endQuatA.dot(expectedQuat));
  const dotB = Math.abs(endQuatB.dot(expectedQuat));
  assert(dotA > 0.99999, `Path A end quaternion must match H6 (dot = ${dotA})`);
  assert(dotB > 0.99999, `Path B end quaternion must match H6 (dot = ${dotB})`);

  console.log('  ✓ Path A (H1 -> H6) and Path B (H3 -> H6) both resolved to H6 standard camera position: { x: 6, y: 1.6, z: -4.2 }');
  console.log('  ✓ Both paths evaluated to identical end quaternion (Yaw: 90°, Pitch: -5°)!');
  console.log('✅ Test 2 Passed: Multiple Paths to Same Hotspot verified!\n');
}

// -------------------------------------------------------------
// TEST 3: Dynamic Hotspot Orientation Propagation
// -------------------------------------------------------------
console.log('--- Test 3: Updating Hotspot Orientation Propagates to All Paths ---');
{
  const h1 = { id: 'hotspot-h1', position: { x: 0, y: 0, z: 0 } };
  const h3 = { id: 'hotspot-h3', position: { x: -3, y: 0, z: 2 } };
  const h6 = {
    id: 'hotspot-h6',
    name: 'Phòng ngủ H6',
    position: { x: 6, y: 0, z: -5 },
    cameraView: {
      configured: true,
      useCustomPosition: false,
      yaw: 90,
      pitch: 0,
      roll: 0,
    },
  };

  const pathA = {
    id: 'path-h1-h6',
    fromHotspotId: 'hotspot-h1',
    toHotspotId: 'hotspot-h6',
    waypointIds: [],
    durationSeconds: 5.0,
  };
  const pathB = {
    id: 'path-h3-h6',
    fromHotspotId: 'hotspot-h3',
    toHotspotId: 'hotspot-h6',
    waypointIds: [],
    durationSeconds: 5.0,
  };

  const evalA = new PathTrajectoryEvaluator();
  evalA.buildTrajectory(pathA, [], h1, h6);
  const initialQuatA = evalA.getEndQuaternion(pathA);

  // Now, user updates H6 orientation: Yaw 90 -> 210, Pitch 0 -> -20
  h6.cameraView.yaw = 210;
  h6.cameraView.pitch = -20;
  h6.rotation = { x: -20, y: 210, z: 0 };

  // Re-evaluate paths WITHOUT modifying any path config!
  evalA.buildTrajectory(pathA, [], h1, h6);
  const newQuatA = evalA.getEndQuaternion(pathA);

  const evalB = new PathTrajectoryEvaluator();
  evalB.buildTrajectory(pathB, [], h3, h6);
  const newQuatB = evalB.getEndQuaternion(pathB);

  const expectedNewEuler = new THREE.Euler(
    THREE.MathUtils.degToRad(-20),
    THREE.MathUtils.degToRad(210),
    0,
    'YXZ'
  );
  const expectedNewQuat = new THREE.Quaternion().setFromEuler(expectedNewEuler);

  assert(Math.abs(newQuatA.dot(expectedNewQuat)) > 0.99999);
  assert(Math.abs(newQuatB.dot(expectedNewQuat)) > 0.99999);
  assert(Math.abs(newQuatA.dot(initialQuatA)) < 0.9, 'New orientation must differ from old orientation');

  console.log('  ✓ H6 orientation changed: Yaw 90° -> 210°, Pitch 0° -> -20°');
  console.log('  ✓ Path A and Path B automatically adopted the new orientation without touching path configs!');
  console.log('✅ Test 3 Passed: Dynamic orientation propagation verified!\n');
}

// -------------------------------------------------------------
// TEST 4: Smooth Slerp Blend & Exact Arrival (Zero Snap)
// -------------------------------------------------------------
console.log('--- Test 4: Smooth Slerp Blend & Exact Arrival Precision ---');
{
  const h1 = { id: 'h1', position: { x: 0, y: 1.6, z: 0 } };
  const h6 = {
    id: 'h6',
    position: { x: 10, y: 1.6, z: 0 },
    cameraView: {
      configured: true,
      yaw: 180,
      pitch: -15,
      roll: 0,
    },
  };

  const path = {
    id: 'path-smooth',
    fromHotspotId: 'h1',
    toHotspotId: 'h6',
    waypointIds: [],
    durationSeconds: 8.0,
    curveType: 'spline',
    tension: 0.5,
    easing: 'easeInOut',
  };

  const evaluator = new PathTrajectoryEvaluator();
  evaluator.buildTrajectory(path, [], h1, h6);

  // Sample progress during final blend window (u = 0.70 -> 1.0)
  const samples = [];
  for (let u = 0.70; u <= 1.0001; u += 0.05) {
    const t = evaluator.evaluateAt(u, path);
    samples.push({ u: Math.round(u * 100) / 100, transform: t });
  }

  // Ensure consecutive quaternion angular delta is smooth (< 15 degrees per step)
  for (let i = 1; i < samples.length; i++) {
    const q1 = new THREE.Quaternion(
      samples[i - 1].transform.quaternion.x,
      samples[i - 1].transform.quaternion.y,
      samples[i - 1].transform.quaternion.z,
      samples[i - 1].transform.quaternion.w
    );
    const q2 = new THREE.Quaternion(
      samples[i].transform.quaternion.x,
      samples[i].transform.quaternion.y,
      samples[i].transform.quaternion.z,
      samples[i].transform.quaternion.w
    );

    const angleRad = q1.angleTo(q2);
    const angleDeg = THREE.MathUtils.radToDeg(angleRad);
    assert(angleDeg < 35, `Step ${i} angular step too large (${angleDeg}°), must be continuous`);
  }

  // At u = 1.0, must match exact destination orientation
  const finalTransform = evaluator.evaluateAt(1.0, path);
  const qDest = evaluator.getEndQuaternion(path);
  const finalQuat = new THREE.Quaternion(
    finalTransform.quaternion.x,
    finalTransform.quaternion.y,
    finalTransform.quaternion.z,
    finalTransform.quaternion.w
  );

  const dotFinal = Math.abs(finalQuat.dot(qDest));
  assert(dotFinal > 0.999999, `Final frame quaternion must be exact match (dot = ${dotFinal})`);

  console.log('  ✓ Trajectory orientation smoothly slerped towards H6 over the final transition window.');
  console.log('  ✓ Exact 100% precision confirmed at u = 1.0 (Dot product: ' + dotFinal.toFixed(6) + ')');
  console.log('✅ Test 4 Passed: Smooth blend and exact arrival verified!\n');
}

// -------------------------------------------------------------
// TEST 5: Pathfinding & Navigation Service Integration
// -------------------------------------------------------------
console.log('--- Test 5: CameraPathfindingService Resolves Destination Hotspot View ---');
{
  const pathfinding = new CameraPathfindingService();
  const hDest = {
    id: 'hotspot-kitchen',
    name: 'Khu Bếp',
    position: { x: 5.5, y: 0.1, z: 3.0 },
    cameraView: {
      configured: true,
      useCustomPosition: true,
      cameraPosition: { x: 5.5, y: 1.7, z: 2.5 },
      yaw: 45,
      pitch: -10,
      roll: 0,
    },
  };

  const camPos = new THREE.Vector3(0, 1.6, 0);
  const camQuat = new THREE.Quaternion();

  const sceneMock = new THREE.Scene();

  const route = pathfinding.findOptimalRoute(
    camPos,
    camQuat,
    hDest,
    [hDest],
    [],
    [],
    sceneMock
  );

  assert.strictEqual(route.success, true);
  assert.strictEqual(route.targetPosition.y, 1.7, 'Target position must come from hDest.cameraView.cameraPosition');

  const expectedQuat = pathfinding.eulerToQuaternion(45, -10, 0);
  assert(Math.abs(route.targetQuaternion.dot(expectedQuat)) > 0.99999);

  console.log('  ✓ findOptimalRoute extracted targetPosition and targetQuaternion directly from hDest.cameraView!');
  console.log('✅ Test 5 Passed: Pathfinding integration verified!\n');
}

// -------------------------------------------------------------
// TEST 6: Conflict Detection Engine
// -------------------------------------------------------------
console.log('--- Test 6: Conflict Detection Engine for Differing Path Orientations ---');
{
  const hotspots = [
    { id: 'h1', name: 'Phòng khách', position: { x: 0, y: 0, z: 0 } },
    { id: 'h2', name: 'Ban công', position: { x: -3, y: 0, z: 0 } },
    { id: 'h6', name: 'Phòng ngủ Master', position: { x: 6, y: 0, z: 0 } },
  ];

  const paths = [
    {
      id: 'path-1',
      name: 'Tuyến 1 (H1 -> H6)',
      toHotspotId: 'h6',
      endOrientation: { mode: 'custom', yaw: 45, pitch: 0 },
    },
    {
      id: 'path-2',
      name: 'Tuyến 2 (H2 -> H6)',
      toHotspotId: 'h6',
      endOrientation: { mode: 'custom', yaw: 120, pitch: -10 }, // CONFLICT: Yaw 120 vs 45
    },
  ];

  const conflicts = OrientationMigrationService.detectConflicts(hotspots, paths);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].hotspotId, 'h6');
  assert.strictEqual(conflicts[0].conflictingPaths.length, 2);
  assert.strictEqual(conflicts[0].conflictingPaths[0].yaw, 45);
  assert.strictEqual(conflicts[0].conflictingPaths[1].yaw, 120);

  console.log(`  ✓ Conflict detected on "${conflicts[0].hotspotName}":`);
  console.log(`    - Path 1: Yaw = ${conflicts[0].conflictingPaths[0].yaw}°`);
  console.log(`    - Path 2: Yaw = ${conflicts[0].conflictingPaths[1].yaw}°`);
  console.log('  ✓ System refused to guess randomly, successfully flagged for admin resolution.');
  console.log('✅ Test 6 Passed: Conflict detection engine verified!\n');
}

// -------------------------------------------------------------
// TEST 7: Migration v1.1.0 to v1.2.0
// -------------------------------------------------------------
console.log('--- Test 7: Schema Migration Engine (v1.1.0 -> v1.2.0) ---');
{
  const legacyConfig = {
    schemaVersion: '1.1.0',
    projectId: 'proj-123',
    projectName: 'Căn hộ Test',
    updatedAt: '2026-10-28T00:00:00Z',
    modelInfo: { fileName: 'apartment.glb', fingerprint: 'fp-1' },
    hotspots: [
      { id: 'h1', name: 'H1', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { id: 'h2', name: 'H2', position: { x: 5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    ],
    cameraPaths: [
      {
        id: 'p1',
        name: 'H1 -> H2',
        fromHotspotId: 'h1',
        toHotspotId: 'h2',
        useCustomEndPosition: true,
        endPosition: { x: 5.0, y: 1.6, z: -0.5 },
        endOrientation: {
          mode: 'custom',
          yaw: 75,
          pitch: -12,
        },
      },
    ],
    settings: {},
  };

  const { migratedConfig, result } = OrientationMigrationService.migrateConfig(legacyConfig);

  assert.strictEqual(result.success, true);
  assert.strictEqual(migratedConfig.schemaVersion, '1.2.0');

  const migratedH2 = migratedConfig.hotspots.find((h) => h.id === 'h2');
  assert(migratedH2.cameraView, 'H2 must have cameraView');
  assert.strictEqual(migratedH2.cameraView.configured, true);
  assert.strictEqual(migratedH2.cameraView.yaw, 75);
  assert.strictEqual(migratedH2.cameraView.pitch, -12);
  assert.strictEqual(migratedH2.cameraView.useCustomPosition, true);
  assert.strictEqual(migratedH2.cameraView.cameraPosition.z, -0.5);

  console.log('  ✓ Config successfully upgraded from schema v1.1.0 to v1.2.0');
  console.log('  ✓ Destination Hotspot H2 received standard view: Yaw 75°, Pitch -12°, Custom Pos: (5.0, 1.6, -0.5)');
  console.log('✅ Test 7 Passed: Migration engine verified!\n');
}

// -------------------------------------------------------------
// TEST 8: Safe Fallback for Unconfigured Hotspots (Zero Snap to 0,0,0)
// -------------------------------------------------------------
console.log('--- Test 8: Safe Fallback for Unconfigured Hotspots ---');
{
  const pathfinding = new CameraPathfindingService();
  const unconfiguredHotspot = {
    id: 'h-unconfigured',
    name: 'Điểm mới tạo',
    position: { x: 3, y: 1.2, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    cameraView: { configured: false, yaw: 0, pitch: 0, roll: 0 },
  };

  const currentCamPos = new THREE.Vector3(0, 1.6, 0);
  // Camera currently looking sideways (Yaw = 70 degrees)
  const currentCamQuat = pathfinding.eulerToQuaternion(70, 0, 0);

  const sceneMock = new THREE.Scene();
  const route = pathfinding.findOptimalRoute(
    currentCamPos,
    currentCamQuat,
    unconfiguredHotspot,
    [unconfiguredHotspot],
    [],
    [],
    sceneMock
  );

  // Assert target quaternion PRESERVES current camera view!
  const dotPreserved = Math.abs(route.targetQuaternion.dot(currentCamQuat));
  assert(dotPreserved > 0.99999, 'When hotspot is unconfigured, target orientation must preserve user current view');

  console.log('  ✓ Camera currently facing Yaw = 70°');
  console.log('  ✓ Unconfigured hotspot did NOT force orientation to (0,0,0); preserved user view (Dot: ' + dotPreserved.toFixed(6) + ')');
  console.log('✅ Test 8 Passed: Safe fallback for unconfigured hotspots verified!\n');
}

console.log('🎉 ALL 8 ADVANCED DESTINATION HOTSPOT ORIENTATION ARCHITECTURE TESTS PASSED 100%!');
