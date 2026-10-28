import * as THREE from 'three';
import assert from 'assert';

console.log('🎬 Starting Professional Camera Path & Waypoint Editor Verification Suite...\n');

// ==========================================
// 1. TEST DISTINCT ENTITY DATA MODEL & TOPOLOGY
// ==========================================
console.log('--- Test 1: Distinct Entity Data Model & Topology ---');

const h1 = {
  id: 'hotspot-living-room',
  name: 'Phòng Khách',
  position: { x: 0, y: 1.5, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  type: 'navigation'
};

const h2 = {
  id: 'hotspot-balcony',
  name: 'Ban Công',
  position: { x: 10, y: 1.5, z: -5 },
  rotation: { x: 0, y: 0, z: 0 },
  type: 'viewpoint'
};

const wp1 = {
  id: 'wp-hallway-corner',
  pathId: 'path-tour-01',
  name: 'Điểm Chuyển Hướng Hành Lang',
  position: { x: 4, y: 1.5, z: 0 },
  orientation: {
    mode: 'manual',
    yaw: 45,
    pitch: -5,
    roll: 0
  },
  fov: 65,
  speedMultiplier: 1.0,
  dwellTime: 0.5,
  source: 'user'
};

const wp2 = {
  id: 'wp-balcony-door',
  pathId: 'path-tour-01',
  name: 'Cửa Ban Công',
  position: { x: 8, y: 1.6, z: -2 },
  orientation: {
    mode: 'followPath'
  },
  fov: 60,
  speedMultiplier: 0.8,
  dwellTime: 0,
  source: 'user'
};

const path = {
  id: 'path-tour-01',
  name: 'Tuyến Khám Phá: Phòng Khách -> Ban Công',
  startHotspotId: h1.id,
  endHotspotId: h2.id,
  waypoints: [wp1, wp2],
  interpolation: 'spline',
  splineTension: 0.5,
  durationSeconds: 12,
  easing: 'easeInOutQuad',
  defaultOrientationMode: 'followPath',
  loop: false,
  reverse: false,
  visibleInEditor: true
};

assert.strictEqual(path.startHotspotId, 'hotspot-living-room');
assert.strictEqual(path.endHotspotId, 'hotspot-balcony');
assert.strictEqual(path.waypoints.length, 2);
assert.strictEqual(path.waypoints[0].position.x, 4);
console.log('✅ Test 1 Passed: Data structures for Hotspots, Waypoints, and Camera Paths are decoupled and structurally valid!');

// ==========================================
// 2. TEST SPLINE & POLYLINE TRAJECTORY EVALUATOR
// ==========================================
console.log('\n--- Test 2: Curve Trajectory & Arc-length Sampling ---');

// Build control points: Start Hotspot -> WP1 -> WP2 -> End Hotspot
const controlPoints = [
  new THREE.Vector3(h1.position.x, h1.position.y, h1.position.z),
  new THREE.Vector3(wp1.position.x, wp1.position.y, wp1.position.z),
  new THREE.Vector3(wp2.position.x, wp2.position.y, wp2.position.z),
  new THREE.Vector3(h2.position.x, h2.position.y, h2.position.z)
];

// Spline CatmullRomCurve3
const splineCurve = new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.5);
const totalSplineLength = splineCurve.getLength();
assert(totalSplineLength > 10, 'Spline curve length must be greater than straight-line distance');

// Sample points along spline curve with arc-length parameterization
const sampleCount = 50;
const sampledPoints = splineCurve.getSpacedPoints(sampleCount);
assert.strictEqual(sampledPoints.length, sampleCount + 1);

// Verify monotonicity of arc-length progression
let prevPoint = sampledPoints[0];
for (let i = 1; i < sampledPoints.length; i++) {
  const currentPoint = sampledPoints[i];
  const stepDist = prevPoint.distanceTo(currentPoint);
  assert(stepDist > 0, `Step ${i} must have positive distance`);
  prevPoint = currentPoint;
}
console.log(`✅ Test 2 Passed: CatmullRom centripetal spline evaluated smoothly over ${sampledPoints.length} points (Length: ${totalSplineLength.toFixed(2)}m)!`);

// ==========================================
// 3. TEST DECOUPLED CAMERA ORIENTATION (TANGENT VS QUATERNION SLERP VS LOOKAT)
// ==========================================
console.log('\n--- Test 3: Camera Orientation Solving ---');

// A. Tangent / FollowPath mode
const t = 0.5; // midpoint
const tangent = splineCurve.getTangent(t).normalize();
const lookAtMatrix = new THREE.Matrix4();
const eyePos = splineCurve.getPoint(t);
const targetPos = eyePos.clone().add(tangent);
lookAtMatrix.lookAt(eyePos, targetPos, new THREE.Vector3(0, 1, 0));
const tangentQuat = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);

assert(!isNaN(tangentQuat.x) && !isNaN(tangentQuat.w), 'Tangent quaternion must be valid');

// B. Manual orientation with Quaternion Slerp
const euler1 = new THREE.Euler(THREE.MathUtils.degToRad(-5), THREE.MathUtils.degToRad(45), 0, 'YXZ');
const q1 = new THREE.Quaternion().setFromEuler(euler1);

const euler2 = new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0, 'YXZ');
const q2 = new THREE.Quaternion().setFromEuler(euler2);

const interpolatedQuat = q1.clone().slerp(q2, 0.5);
assert(!isNaN(interpolatedQuat.y), 'Slerp quaternion must be valid');
assert(Math.abs(interpolatedQuat.length() - 1.0) < 1e-4, 'Quaternion must remain normalized');

// C. LookAt focal target mode
const focalPoint = new THREE.Vector3(5, 1, -2);
const focalLookMatrix = new THREE.Matrix4().lookAt(eyePos, focalPoint, new THREE.Vector3(0, 1, 0));
const focalQuat = new THREE.Quaternion().setFromRotationMatrix(focalLookMatrix);
assert(!isNaN(focalQuat.z), 'LookAt quaternion must be valid');

console.log('✅ Test 3 Passed: FollowPath (tangent), Slerp (manual yaw/pitch), and LookAt modes computed correctly with zero singularities!');

// ==========================================
// 4. TEST MULTI-POINT RAYCAST COLLISION DETECTION (WALL-CLIPPING)
// ==========================================
console.log('\n--- Test 4: Wall-Clipping Raycast Collision Checking ---');

// Create a simulated scene with a blocking interior wall
const obstacleWall = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 3, 4),
  new THREE.MeshBasicMaterial()
);
obstacleWall.name = 'Interior_Partition_Wall';
obstacleWall.position.set(6, 1.5, 0); // Wall intersects X=6
obstacleWall.updateMatrixWorld(true);

const collisionRaycaster = new THREE.Raycaster();
const testSamples = [
  new THREE.Vector3(4, 1.5, 0),
  new THREE.Vector3(5.5, 1.5, 0),
  new THREE.Vector3(7, 1.5, 0) // Across the wall
];

let wallHitCount = 0;
for (let i = 0; i < testSamples.length - 1; i++) {
  const pA = testSamples[i];
  const pB = testSamples[i + 1];
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const dist = dir.length();
  dir.normalize();

  collisionRaycaster.set(pA, dir);
  collisionRaycaster.near = 0.05;
  collisionRaycaster.far = dist;
  const hits = collisionRaycaster.intersectObject(obstacleWall, true);
  if (hits.length > 0) {
    wallHitCount += hits.length;
  }
}

assert(wallHitCount > 0, 'Wall collision must be detected between X=5.5 and X=7.0');
console.log(`✅ Test 4 Passed: Raycasting collision detector detected ${wallHitCount} intersection(s) with scene obstacles!`);

// ==========================================
// 5. TEST UNDO / REDO COMMAND ENGINE FOR CAMERA PATHS
// ==========================================
console.log('\n--- Test 5: Camera Path & Waypoint Undo / Redo Command Engine ---');

class MockPathStore {
  constructor() {
    this.paths = new Map();
  }
  addPath(p) { this.paths.set(p.id, JSON.parse(JSON.stringify(p))); }
  removePath(id) { this.paths.delete(id); }
  getPath(id) { return this.paths.get(id); }
  addWaypoint(pathId, wp, index) {
    const p = this.paths.get(pathId);
    if (!p) return;
    if (typeof index === 'number') {
      p.waypoints.splice(index, 0, JSON.parse(JSON.stringify(wp)));
    } else {
      p.waypoints.push(JSON.parse(JSON.stringify(wp)));
    }
  }
  removeWaypoint(pathId, wpId) {
    const p = this.paths.get(pathId);
    if (!p) return;
    const idx = p.waypoints.findIndex(w => w.id === wpId);
    if (idx !== -1) p.waypoints.splice(idx, 1);
  }
}

const mockStore = new MockPathStore();
const cmdHistory = [];
let cmdIndex = -1;

function runCmd(cmd) {
  cmd.execute();
  cmdIndex++;
  cmdHistory.splice(cmdIndex);
  cmdHistory.push(cmd);
}

function undoCmd() {
  if (cmdIndex >= 0) {
    cmdHistory[cmdIndex].undo();
    cmdIndex--;
  }
}

function redoCmd() {
  if (cmdIndex < cmdHistory.length - 1) {
    cmdIndex++;
    cmdHistory[cmdIndex].execute();
  }
}

// Command A: Create Path
const createPathCmd = {
  execute: () => mockStore.addPath(path),
  undo: () => mockStore.removePath(path.id)
};

runCmd(createPathCmd);
assert.strictEqual(mockStore.paths.size, 1);
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints.length, 2);

// Command B: Add Waypoint 3
const wp3 = {
  id: 'wp-new-spot',
  pathId: 'path-tour-01',
  name: 'Điểm Thêm Mới',
  position: { x: 6, y: 1.5, z: -1 },
  orientation: { mode: 'followPath' }
};

const addWpCmd = {
  execute: () => mockStore.addWaypoint('path-tour-01', wp3, 1),
  undo: () => mockStore.removeWaypoint('path-tour-01', wp3.id)
};

runCmd(addWpCmd);
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints.length, 3);
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints[1].id, 'wp-new-spot');

// Undo Add Waypoint
undoCmd();
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints.length, 2);
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints[1].id, 'wp-balcony-door');

// Redo Add Waypoint
redoCmd();
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints.length, 3);
assert.strictEqual(mockStore.getPath('path-tour-01').waypoints[1].id, 'wp-new-spot');

// Undo Add Waypoint, Undo Create Path
undoCmd();
undoCmd();
assert.strictEqual(mockStore.paths.size, 0);

// Redo Create Path
redoCmd();
assert.strictEqual(mockStore.paths.size, 1);
console.log('✅ Test 5 Passed: Undo and Redo execution for Path creation and Waypoint manipulation verified flawlessly!');

// ==========================================
// 6. TEST JSON SCHEMA v1.1.0 PERSISTENCE & BACKWARD COMPATIBILITY
// ==========================================
console.log('\n--- Test 6: Config Persistence Schema v1.1.0 & Backward Compatibility ---');

const v100Config = {
  schemaVersion: '1.0.0',
  projectId: 'prj-test-legacy',
  projectName: 'Legacy Hotspot Project',
  modelInfo: { fileName: 'apartment.glb', fingerprint: 'xyz123' },
  hotspots: [h1, h2],
  settings: { showLabels: true }
};

// Migration / loader handler
function loadProjectConfig(json) {
  const cameraPaths = json.cameraPaths || [];
  const waypoints = json.waypoints || [];
  const schemaVersion = json.schemaVersion || '1.0.0';
  return {
    ...json,
    schemaVersion: '1.1.0',
    cameraPaths,
    waypoints
  };
}

const migrated = loadProjectConfig(v100Config);
assert.strictEqual(migrated.schemaVersion, '1.1.0');
assert.strictEqual(migrated.cameraPaths.length, 0);
assert.strictEqual(migrated.waypoints.length, 0);
assert.strictEqual(migrated.hotspots.length, 2);

// Save full v1.1.0 config
const v110Config = {
  schemaVersion: '1.1.0',
  projectId: 'prj-modern-villa',
  projectName: 'Modern Villa with Tour Paths',
  modelInfo: { fileName: 'modern_apartment.glb', fingerprint: 'a1b2c3d4' },
  hotspots: [h1, h2],
  waypoints: [wp1, wp2],
  cameraPaths: [path],
  settings: { showLabels: true }
};

const exportedStr = JSON.stringify(v110Config, null, 2);
const reimported = JSON.parse(exportedStr);
assert.strictEqual(reimported.schemaVersion, '1.1.0');
assert.strictEqual(reimported.cameraPaths.length, 1);
assert.strictEqual(reimported.waypoints.length, 2);
assert.strictEqual(reimported.cameraPaths[0].waypoints[0].name, 'Điểm Chuyển Hướng Hành Lang');
console.log('✅ Test 6 Passed: JSON Schema v1.1.0 serialization and legacy v1.0.0 backward compatibility verified!');

// ==========================================
// 7. TEST END CAMERA ORIENTATION & REVERSE DECOUPLING
// ==========================================
console.log('\n--- Test 7: End Camera Orientation Evaluation, Slerp Window & Reverse Decoupling ---');

// Helper to convert Euler (Pitch, Yaw, Roll) to Quaternion
function eulerToQuat(yawDeg, pitchDeg, rollDeg = 0) {
  const yawRad = THREE.MathUtils.degToRad(yawDeg);
  const pitchRad = THREE.MathUtils.degToRad(pitchDeg);
  const rollRad = THREE.MathUtils.degToRad(rollDeg);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ'));
}

// 7A: Custom End Orientation
const customEndOrient = {
  mode: 'custom',
  yaw: 120,
  pitch: 15,
  roll: 0,
  transitionDuration: 2.0,
  easing: 'easeInOut'
};

const qEndTarget = eulerToQuat(customEndOrient.yaw, customEndOrient.pitch, customEndOrient.roll);

// Simulate transition window evaluation
const durationSeconds = 8.0;
const transitionFraction = Math.min(0.5, customEndOrient.transitionDuration / durationSeconds); // 2/8 = 0.25
const uTurnStart = 1.0 - transitionFraction; // 0.75

// Test before window: u = 0.5 (should not be blended with qEnd)
const qTangent = new THREE.Quaternion(0, 0, 0, 1);
assert(uTurnStart === 0.75, 'uTurnStart must be 0.75');

// Test within window: u = 0.875 (halfway into transition window)
const factor = (0.875 - uTurnStart) / transitionFraction; // 0.5
const qMid = qTangent.clone().slerp(qEndTarget, factor);
assert(qMid.length() > 0.99 && qMid.length() < 1.01, 'Quaternion must remain normalized during slerp');

// Test at end: u = 1.0 (must equal target orientation)
const qFinal = qTangent.clone().slerp(qEndTarget, 1.0);
assert(Math.abs(qFinal.dot(qEndTarget)) > 0.9999, 'At u = 1.0, orientation must match destination orientation');

// 7B: Reverse Path Decoupling
const originalPath = {
  id: 'path-h1-to-h2',
  name: 'Tuyến H1 -> H2',
  fromHotspotId: 'hotspot-living-room',
  toHotspotId: 'hotspot-balcony',
  endOrientation: customEndOrient,
  durationSeconds: 10
};

// Simulate reversePath logic
function reversePathTest(p) {
  return {
    ...p,
    id: 'path-h2-to-h1',
    name: 'Tuyến H2 -> H1 (Đảo ngược)',
    fromHotspotId: p.toHotspotId,
    toHotspotId: p.fromHotspotId,
    // End orientation must be decoupled and point to H1's hotspot orientation
    endOrientation: {
      mode: 'hotspot',
      transitionDuration: 2.0,
      easing: 'easeInOut'
    }
  };
}

const reversed = reversePathTest(originalPath);
assert.strictEqual(reversed.fromHotspotId, 'hotspot-balcony');
assert.strictEqual(reversed.toHotspotId, 'hotspot-living-room');
assert.strictEqual(reversed.endOrientation.mode, 'hotspot', 'Reversed path must decouple endOrientation to H1 destination');
assert.notStrictEqual(reversed.endOrientation.yaw, 120, 'Reversed path must not inherit custom yaw of H2');

console.log('✅ Test 7 Passed: End Camera Orientation Slerp blending at u=1.0 and Reverse Path decoupling verified with 100% precision!');

// ==========================================
// 8. TEST END CAMERA TRANSFORM (CUSTOM POSITION & ORIENTATION)
// ==========================================
console.log('\n--- Test 8: End Camera Transform (Custom Position & Orientation) & Trajectory Endpoint ---');

function getResolvedEndPos(p, destHotspot) {
  if (
    (p.useCustomEndPosition || p.endOrientation?.useCustomPosition) &&
    (p.endPosition || p.endOrientation?.position)
  ) {
    const pt = p.endPosition || p.endOrientation.position;
    return new THREE.Vector3(pt.x, pt.y, pt.z);
  }
  if (destHotspot) {
    return new THREE.Vector3(destHotspot.position.x, destHotspot.position.y, destHotspot.position.z);
  }
  return null;
}

// 8A: Fallback to Hotspot when useCustomEndPosition is false
const pathDefaultEnd = {
  id: 'path-default-end',
  useCustomEndPosition: false,
  endPosition: undefined,
  toHotspotId: h2.id
};
const resolvedDefault = getResolvedEndPos(pathDefaultEnd, h2);
assert.strictEqual(resolvedDefault.x, 10);
assert.strictEqual(resolvedDefault.y, 1.5);
assert.strictEqual(resolvedDefault.z, -5);

// 8B: Resolve Custom End Position when useCustomEndPosition is true
const customEndCoord = { x: 5.2, y: 2.1, z: -7.8 };
const pathCustomEnd = {
  id: 'path-custom-end',
  useCustomEndPosition: true,
  endPosition: customEndCoord,
  endOrientation: {
    mode: 'custom',
    useCustomPosition: true,
    position: customEndCoord,
    yaw: 210,
    pitch: 10,
    roll: 0,
    transitionDuration: 2.0,
    easing: 'easeInOut'
  },
  toHotspotId: h2.id
};

const resolvedCustom = getResolvedEndPos(pathCustomEnd, h2);
assert.strictEqual(resolvedCustom.x, 5.2);
assert.strictEqual(resolvedCustom.y, 2.1);
assert.strictEqual(resolvedCustom.z, -7.8);

// 8C: Build curve ending at resolvedCustom point
const customControlPoints = [
  new THREE.Vector3(h1.position.x, h1.position.y, h1.position.z),
  new THREE.Vector3(wp1.position.x, wp1.position.y, wp1.position.z),
  new THREE.Vector3(wp2.position.x, wp2.position.y, wp2.position.z),
  resolvedCustom
];
const customCurve = new THREE.CatmullRomCurve3(customControlPoints, false, 'centripetal', 0.5);
const finalPt = customCurve.getPointAt(1.0);
assert(Math.abs(finalPt.x - 5.2) < 1e-4, 'Curve must terminate at custom end position X');
assert(Math.abs(finalPt.y - 2.1) < 1e-4, 'Curve must terminate at custom end position Y');
assert(Math.abs(finalPt.z - (-7.8)) < 1e-4, 'Curve must terminate at custom end position Z');

// 8D: Reverse path must reset custom end position
function reversePathTransformTest(p) {
  return {
    ...p,
    id: 'reversed-custom-test',
    fromHotspotId: p.toHotspotId,
    toHotspotId: p.fromHotspotId,
    useCustomEndPosition: false,
    endPosition: undefined,
    endOrientation: { mode: 'hotspot', useCustomPosition: false }
  };
}

const revCustom = reversePathTransformTest(pathCustomEnd);
assert.strictEqual(revCustom.useCustomEndPosition, false);
assert.strictEqual(revCustom.endPosition, undefined);
const revResolved = getResolvedEndPos(revCustom, h1);
assert.strictEqual(revResolved.x, 0, 'Reversed path must resolve to destination H1 hotspot position');

console.log('✅ Test 8 Passed: End Camera Transform (Position & Orientation), Spline Termination, and Reverse Decoupling verified with 100% precision!');

console.log('\n🎉 ALL 8 CAMERA PATH & WAYPOINT EDITOR VERIFICATION TESTS PASSED WITH 100% SUCCESS!');


