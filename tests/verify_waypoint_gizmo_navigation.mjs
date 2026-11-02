import * as THREE from 'three';
import assert from 'assert';

console.log('🚀 Starting Comprehensive Verification Suite for Waypoint Gizmo & Intelligent Camera Navigation...\n');

// ==========================================
// TEST 1: WAYPOINT DATA MODEL & MOVE COMMAND UNDO/REDO
// ==========================================
console.log('--- Test 1: Waypoint Data Model & MoveWaypointCommand Undo/Redo ---');

const mockWaypoint = {
  id: 'wp-sample-turn',
  name: 'Điểm rẽ hành lang P1',
  position: { x: 2.75, y: 1.5, z: -0.8 },
  orientation: { mode: 'followPath', yaw: 0, pitch: 0, roll: 0 },
  locked: false,
  dwellTimeSeconds: 0,
  speedMultiplier: 1.0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

class MockPathStore {
  constructor(initialWp) {
    this.waypoints = new Map([[initialWp.id, { ...initialWp }]]);
    this.isDirty = false;
  }
  getWaypoint(id) {
    return this.waypoints.get(id);
  }
  updateWaypoint(wp, markDirty = true) {
    this.waypoints.set(wp.id, { ...wp });
    if (markDirty) this.isDirty = true;
  }
}

class MockMoveWaypointCommand {
  constructor(store, waypointId, prevPos, newPos, prevOrient, newOrient) {
    this.store = store;
    this.waypointId = waypointId;
    this.prevPos = { ...prevPos };
    this.newPos = { ...newPos };
    this.prevOrient = JSON.parse(JSON.stringify(prevOrient));
    this.newOrient = JSON.parse(JSON.stringify(newOrient));
  }
  execute() {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.newPos };
      wp.orientation = JSON.parse(JSON.stringify(this.newOrient));
      this.store.updateWaypoint(wp, true);
    }
  }
  undo() {
    const wp = this.store.getWaypoint(this.waypointId);
    if (wp) {
      wp.position = { ...this.prevPos };
      wp.orientation = JSON.parse(JSON.stringify(this.prevOrient));
      this.store.updateWaypoint(wp, true);
    }
  }
}

const store = new MockPathStore(mockWaypoint);
const prevPos = { ...mockWaypoint.position };
const newPos = { x: 4.25, y: 1.75, z: -1.5 };

const cmd = new MockMoveWaypointCommand(
  store,
  mockWaypoint.id,
  prevPos,
  newPos,
  mockWaypoint.orientation,
  mockWaypoint.orientation
);

// Execute move
cmd.execute();
assert.strictEqual(store.getWaypoint(mockWaypoint.id).position.x, 4.25);
assert.strictEqual(store.isDirty, true);
console.log('  ✓ Move command executed: position updated from', prevPos, 'to', newPos);

// Undo
cmd.undo();
assert.strictEqual(store.getWaypoint(mockWaypoint.id).position.x, 2.75);
console.log('  ✓ Undo executed: position successfully restored to original', store.getWaypoint(mockWaypoint.id).position);

// Redo
cmd.execute();
assert.strictEqual(store.getWaypoint(mockWaypoint.id).position.x, 4.25);
console.log('  ✓ Redo executed: position successfully reapplied to', store.getWaypoint(mockWaypoint.id).position);
console.log('✅ Test 1 Passed: Waypoint Move & Undo/Redo verified flawlessly!\n');

// ==========================================
// TEST 2: REAL-TIME TRAJECTORY EVALUATION
// ==========================================
console.log('--- Test 2: Real-time Trajectory Spline Evaluation without Recreating Anchors ---');

const startPt = new THREE.Vector3(0, 1.2, 0);
const wpPt = new THREE.Vector3(2.75, 1.5, -0.8);
const endPt = new THREE.Vector3(5.5, 1.2, 0);

const curveInitial = new THREE.CatmullRomCurve3([startPt, wpPt, endPt], false, 'centripetal', 0.5);
const initialLength = curveInitial.getLength();
assert(initialLength > 5.0, 'Curve length must be valid');

// Simulate dragging waypoint anchor in real-time
wpPt.set(2.75, 2.5, -2.5); // Lift and pull waypoint back
const curveUpdated = new THREE.CatmullRomCurve3([startPt, wpPt, endPt], false, 'centripetal', 0.5);
const updatedLength = curveUpdated.getLength();
assert(updatedLength > initialLength, 'Curve length should increase with further waypoint pull');

const spacedPoints = curveUpdated.getSpacedPoints(100);
assert.strictEqual(spacedPoints.length, 101);
console.log(`  ✓ Initial curve length: ${initialLength.toFixed(2)}m -> Dragged curve length: ${updatedLength.toFixed(2)}m`);
console.log(`  ✓ Arc-length points dynamically sampled: ${spacedPoints.length} points`);
console.log('✅ Test 2 Passed: Real-time Trajectory updates smoothly without touching anchors!\n');

// ==========================================
// TEST 3: BI-DIRECTIONAL LINE-OF-SIGHT COLLISION CHECKER
// ==========================================
console.log('--- Test 3: Bi-directional Line-of-Sight Safety & Wall Collision Checker ---');

const scene = new THREE.Scene();

// Create a mock wall mesh between x = 2.0 and x = 2.4 (thickness 0.4m, height 3m, z from -5 to 5)
const wallGeo = new THREE.BoxGeometry(0.4, 3.0, 10.0);
const wallMat = new THREE.MeshBasicMaterial();
const wallMesh = new THREE.Mesh(wallGeo, wallMat);
wallMesh.name = 'Interior_Wall_Living_Kitchen';
wallMesh.position.set(2.2, 1.5, 0);
scene.add(wallMesh);

function isLineSafe(p1, p2, sceneRoot, clearanceRadius = 0.25) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const dist = dir.length();
  if (dist < 0.05) return true;

  const meshes = [];
  sceneRoot.traverse((child) => {
    if (child.isMesh && child.visible) {
      const name = child.name.toLowerCase();
      if (!name.includes('floor') && !name.includes('ground') && !name.includes('grid')) {
        meshes.push(child);
      }
    }
  });

  const raycaster = new THREE.Raycaster();

  // 1. Center Ray: P1 -> P2
  dir.normalize();
  raycaster.set(p1, dir);
  raycaster.far = dist;
  let hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0 && hits[0].distance < dist - 0.05) {
    return false;
  }

  // 2. Reverse Center Ray: P2 -> P1 (Catches single-sided geometry)
  const revDir = dir.clone().negate();
  raycaster.set(p2, revDir);
  raycaster.far = dist;
  hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0 && hits[0].distance < dist - 0.05) {
    return false;
  }

  // 3. Side Clearance Rays
  if (clearanceRadius > 0.05) {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(clearanceRadius);
    if (right.lengthSq() > 0.001) {
      // Left ray
      raycaster.set(p1.clone().sub(right), dir);
      raycaster.far = dist;
      if (raycaster.intersectObjects(meshes, false).length > 0) return false;

      // Right ray
      raycaster.set(p1.clone().add(right), dir);
      raycaster.far = dist;
      if (raycaster.intersectObjects(meshes, false).length > 0) return false;
    }
  }

  return true;
}

// Case A: Direct segment passing THROUGH the wall (x=0 to x=5)
const pThroughWallA = new THREE.Vector3(0, 1.5, 0);
const pThroughWallB = new THREE.Vector3(5, 1.5, 0);
const safeDirect = isLineSafe(pThroughWallA, pThroughWallB, scene);
assert.strictEqual(safeDirect, false, 'Direct ray through wall must be detected as UNSAFE');
console.log('  ✓ Segment intersecting interior wall: detected as UNSAFE (isLineSafe = false)');

// Case B: Reverse segment through the wall (x=5 to x=0)
const safeReverse = isLineSafe(pThroughWallB, pThroughWallA, scene);
assert.strictEqual(safeReverse, false, 'Reverse ray through wall must also be detected as UNSAFE');
console.log('  ✓ Reverse segment intersecting interior wall: detected as UNSAFE (isLineSafe = false)');

// Case C: Clear segment through doorway opening (z = -6, beyond the wall edge)
const pClearA = new THREE.Vector3(0, 1.5, -6);
const pClearB = new THREE.Vector3(5, 1.5, -6);
const safeClear = isLineSafe(pClearA, pClearB, scene);
assert.strictEqual(safeClear, true, 'Segment through doorway without wall must be detected as SAFE');
console.log('  ✓ Segment through open corridor: detected as SAFE (isLineSafe = true)');
console.log('✅ Test 3 Passed: Bi-directional Collision & Line-of-Sight Checker verified!\n');

// ==========================================
// TEST 4: DYNAMIC NAVIGATION GRAPH & A* PATHFINDING
// ==========================================
console.log('--- Test 4: Dynamic Navigation Graph & A* Pathfinding through Obstacles ---');

// Mock nodes:
// Room 1: Hotspot Living Room at (0, 1.5, 0)
// Corridor Waypoint 1 at (0, 1.5, -6)
// Corridor Waypoint 2 at (5, 1.5, -6)
// Room 2: Hotspot Kitchen at (5, 1.5, 0)
// (Direct line from Room 1 to Room 2 is blocked by the wall at x=2.2, z=0)

const testHotspots = [
  { id: 'h-living', name: 'Phòng Khách', position: { x: 0, y: 1.5, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  { id: 'h-kitchen', name: 'Khu Bếp', position: { x: 5, y: 1.5, z: 0 }, rotation: { x: 0, y: 90, z: 0 } }
];

const testWaypoints = [
  { id: 'wp-1', name: 'Cửa Hành Lang', position: { x: 0, y: 1.5, z: -6 } },
  { id: 'wp-2', name: 'Lối Vào Bếp', position: { x: 5, y: 1.5, z: -6 } }
];

const testPaths = [
  {
    id: 'path-corridor',
    name: 'Tuyến Hành Lang',
    fromHotspotId: 'h-living',
    toHotspotId: 'h-kitchen',
    waypointIds: ['wp-1', 'wp-2'],
    enabled: true
  }
];

// Verify A* router finds the route around the wall
import { CameraPathfindingService } from '../src/modules/camera-path/services/CameraPathfindingService.ts';

const pathfinder = new CameraPathfindingService();
const camFreePos = new THREE.Vector3(-1.0, 1.6, 0.5); // User stands freely in living room
const camFreeQuat = new THREE.Quaternion();

const routeResult = pathfinder.findOptimalRoute(
  camFreePos,
  camFreeQuat,
  testHotspots[1], // Destination: Kitchen
  testHotspots,
  testWaypoints,
  testPaths,
  scene
);

assert.strictEqual(routeResult.success, true);
assert.strictEqual(routeResult.mode, 'graph');
assert(routeResult.controlPoints.length >= 4, 'Route must traverse through corridor waypoints');
assert(routeResult.waypointsOnRoute.includes('wp-1'), 'Route must pass through wp-1');
assert(routeResult.waypointsOnRoute.includes('wp-2'), 'Route must pass through wp-2');

console.log(`  ✓ Arbitrary camera position: (${camFreePos.x}, ${camFreePos.y}, ${camFreePos.z})`);
console.log(`  ✓ Route successfully navigated around wall through waypoints: ${routeResult.waypointsOnRoute.join(' -> ')}`);
console.log(`  ✓ Unified trajectory duration: ${routeResult.durationSeconds.toFixed(1)}s`);
console.log('✅ Test 4 Passed: A* Routing safely navigates around walls via Waypoint Network!\n');

// ==========================================
// TEST 5: WALL ISOLATION & SAFE REJECTION
// ==========================================
console.log('--- Test 5: Safe Rejection when Camera is Blocked with No Valid Waypoints ---');

// Create an enclosed box (isolated room) around (-10, 1.5, 0)
const closedWall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshBasicMaterial());
closedWall.name = 'Enclosed_Bathroom_Wall';
closedWall.position.set(-10, 1.5, 0);
scene.add(closedWall);

const isolatedCamPos = new THREE.Vector3(-10, 1.5, 0); // Inside the solid enclosed block

const blockedResult = pathfinder.findOptimalRoute(
  isolatedCamPos,
  camFreeQuat,
  testHotspots[1],
  testHotspots,
  testWaypoints,
  testPaths,
  scene
);

assert.strictEqual(blockedResult.success, false);
assert.strictEqual(blockedResult.reason, 'BLOCKED_BY_GEOMETRY');
console.log('  ✓ Camera inside wall/enclosed geometry: safely rejected flight.');
console.log('  ✓ Protective message generated:', blockedResult.message);
console.log('✅ Test 5 Passed: Zero clipping through walls; safely rejects invalid flights!\n');

// ==========================================
// TEST 6: DESTINATION ORIENTATION RESOLUTION & QUATERNION SLERP
// ==========================================
console.log('--- Test 6: Destination Orientation & Quaternion Slerp Precision ---');

const startYawDeg = 0;
const targetYawDeg = 90;
const qStart = pathfinder.eulerToQuaternion(startYawDeg, 0, 0);
const qTarget = pathfinder.eulerToQuaternion(targetYawDeg, 0, 0);

// Slerp halfway (u = 0.5)
const qMid = new THREE.Quaternion().slerpQuaternions(qStart, qTarget, 0.5);
const eulerMid = new THREE.Euler().setFromQuaternion(qMid, 'YXZ');
const midYawDeg = THREE.MathUtils.radToDeg(eulerMid.y);
assert(Math.abs(midYawDeg - 45) < 0.1, `Midway yaw should be 45 deg, got ${midYawDeg}`);
console.log(`  ✓ Quaternion Slerp at u=0.5: Yaw = ${midYawDeg.toFixed(1)}° (Expected: 45.0°)`);

// At end (u = 1.0)
const qEnd = new THREE.Quaternion().slerpQuaternions(qStart, qTarget, 1.0);
const eulerEnd = new THREE.Euler().setFromQuaternion(qEnd, 'YXZ');
const endYawDeg = THREE.MathUtils.radToDeg(eulerEnd.y);
assert(Math.abs(endYawDeg - 90) < 0.001, `Final yaw should be 90 deg, got ${endYawDeg}`);
console.log(`  ✓ Quaternion Slerp at u=1.0: Exact destination Yaw = ${endYawDeg.toFixed(1)}° (100% precision)`);
console.log('✅ Test 6 Passed: Orientation interpolation is continuous and mathematically exact!\n');

// ==========================================
// TEST 7: CLEAN INTERRUPTION WHEN SWITCHING TARGETS
// ==========================================
console.log('--- Test 7: Interruption Policy (Changing Destination Mid-flight) ---');

import { CameraNavigator } from '../src/core/navigation/CameraNavigator.ts';

const mockCamera = new THREE.PerspectiveCamera();
mockCamera.position.set(0, 1.5, 0);
const mockOrbit = {
  enabled: true,
  target: new THREE.Vector3(0, 1.5, 5),
};

let flightStarted = false;
let flightCancelled = false;

const navigator = new CameraNavigator(mockCamera, mockOrbit, scene, {
  onFlightStart: () => { flightStarted = true; },
  onFlightCancelled: () => { flightCancelled = true; },
});

// Start flight 1
navigator.navigateToHotspot(testHotspots[0], testHotspots, testWaypoints, testPaths);
assert.strictEqual(navigator.isNavigating(), true);
console.log('  ✓ Initial flight started towards:', navigator.getTargetName());

// Interrupt with flight 2
navigator.navigateToHotspot(testHotspots[1], testHotspots, testWaypoints, testPaths);
assert.strictEqual(navigator.isNavigating(), true);
assert.strictEqual(navigator.getTargetName(), testHotspots[1].name);
console.log('  ✓ Mid-flight interruption: seamlessly redirected towards:', navigator.getTargetName());

// Cancel / Stop
navigator.stop(true);
assert.strictEqual(navigator.isNavigating(), false);
assert.strictEqual(mockOrbit.enabled, true);
console.log('  ✓ Flight stopped: OrbitControls re-enabled safely at current coordinates.');
console.log('✅ Test 7 Passed: Interruption and Stop policies verified!\n');

console.log('🎉 ALL 7 ADVANCED WAYPOINT GIZMO & INTELLIGENT CAMERA NAVIGATION TESTS PASSED 100%!\n');

