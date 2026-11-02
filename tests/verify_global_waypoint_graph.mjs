import assert from 'assert';
import * as THREE from 'three';
import { WaypointGraphStore } from '../src/modules/camera-path/store/WaypointGraphStore.ts';
import { CameraPathStore } from '../src/modules/camera-path/store/CameraPathStore.ts';
import { HotspotStore } from '../src/modules/hotspots/store/HotspotStore.ts';
import { CameraPathfindingService } from '../src/modules/camera-path/services/CameraPathfindingService.ts';
import { GraphDiagnosticsService } from '../src/modules/camera-path/services/GraphDiagnosticsService.ts';
import { ConfigStorageService } from '../src/modules/config/services/ConfigStorageService.ts';
import { DeleteGlobalWaypointCommand } from '../src/modules/camera-path/commands/DeleteGlobalWaypointCommand.ts';
import { CommandHistory } from '../src/shared/history/CommandHistory.ts';

console.log('🌐 Starting Comprehensive Verification Suite for Global Waypoint Graph Editor...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  console.log(`--- Test ${totalTests}: ${testName} ---`);
  try {
    fn();
    passedTests++;
    console.log(`✅ Test ${totalTests} Passed: ${testName}!\n`);
  } catch (err) {
    console.error(`❌ Test ${totalTests} Failed: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// TEST 1: Thêm Waypoint độc lập chưa thuộc Camera Path
// -------------------------------------------------------------
runTest('Thêm Waypoint độc lập chưa thuộc Camera Path', () => {
  const graphStore = new WaypointGraphStore();
  const pathStore = new CameraPathStore();

  const wp1 = graphStore.createWaypoint('Hành lang P1', { x: 2.0, y: 1.6, z: -3.0 }, {
    zone: 'Hành lang',
    floor: 1,
  });

  const allWps = graphStore.getAllWaypoints();
  assert.strictEqual(allWps.length, 1, 'Thư viện waypoint phải có đúng 1 waypoint');
  assert.strictEqual(allWps[0].name, 'Hành lang P1');
  assert.strictEqual(allWps[0].zone, 'Hành lang');
  assert.strictEqual(allWps[0].status, 'active');

  // Verify it does not belong to any Camera Path
  const allPaths = pathStore.getAllPaths();
  const pathsContainingWp = allPaths.filter(p => p.waypointIds.includes(wp1.id));
  assert.strictEqual(pathsContainingWp.length, 0, 'Waypoint độc lập không được tự động gán vào path');

  console.log(`  ✓ Waypoint "${wp1.name}" (ID: ${wp1.id}) tồn tại độc lập trong Global Graph`);
});

// -------------------------------------------------------------
// TEST 2: Tạo kết nối hợp lệ với các waypoint lân cận (Auto-Connect)
// -------------------------------------------------------------
runTest('Tạo kết nối hợp lệ với các waypoint lân cận', () => {
  const graphStore = new WaypointGraphStore();

  // Create 3 waypoints forming a triangle in open space
  const wA = graphStore.createWaypoint('Phòng khách A', { x: 0, y: 1.6, z: 0 });
  const wB = graphStore.createWaypoint('Phòng khách B', { x: 3, y: 1.6, z: 0 });
  const wC = graphStore.createWaypoint('Bếp C', { x: 3, y: 1.6, z: 4 });

  // Propose connections with maxDistance = 6.0m
  const result = graphStore.proposeConnections({
    maxDistance: 6.0,
    maxHeightDiff: 1.5,
    bidirectional: true,
  });

  // Distances: A-B = 3m (<=6m), B-C = 4m (<=6m), A-C = 5m (<=6m) -> 3 edges
  assert.strictEqual(result.proposedCount, 3, 'Phải đề xuất 3 cạnh kết nối');
  assert.strictEqual(result.validCount, 3, 'Tất cả 3 cạnh phải ở trạng thái valid');

  const edges = graphStore.getAllEdges();
  assert.strictEqual(edges.length, 3);
  for (const edge of edges) {
    assert.strictEqual(edge.status, 'valid');
    assert.strictEqual(edge.direction, 'bidirectional');
    assert.ok(edge.distance > 0);
  }

  console.log(`  ✓ Tự động tạo thành công ${edges.length} cạnh hai chiều hợp lệ:`);
  edges.forEach(e => console.log(`    • Cạnh ${e.id.slice(0, 8)}: Khoảng cách = ${e.distance}m, Trạng thái = ${e.status}`));
});

// -------------------------------------------------------------
// TEST 3: Phát hiện waypoint gần nhưng bị tường chắn (Raycast Obstacle)
// -------------------------------------------------------------
runTest('Phát hiện waypoint gần nhưng bị tường chắn', () => {
  const graphStore = new WaypointGraphStore();

  const wLiving = graphStore.createWaypoint('Phòng khách', { x: 0, y: 1.6, z: 0 });
  const wBed = graphStore.createWaypoint('Phòng ngủ', { x: 4, y: 1.6, z: 0 });

  // Simulate an obstacle checker: segment between living and bed is blocked by a wall at x = 2
  const isLineSafeMock = (p1, p2) => {
    // If line crosses x = 2, wall blocks it
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    if (minX < 2.0 && maxX > 2.0) {
      return false; // Wall collision!
    }
    return true;
  };

  const result = graphStore.proposeConnections(
    { maxDistance: 6.0, maxHeightDiff: 1.5, bidirectional: true },
    isLineSafeMock
  );

  assert.strictEqual(result.proposedCount, 1);
  assert.strictEqual(result.blockedCount, 1, 'Cạnh xuyên tường phải được phân loại là blocked');
  assert.strictEqual(result.validCount, 0);

  const edge = graphStore.getAllEdges()[0];
  assert.strictEqual(edge.status, 'blocked');

  console.log(`  ✓ Phát hiện va chạm tường ngăn cách tại x = 2.0m: Cạnh được đánh dấu trạng thái "${edge.status}"`);
});

// -------------------------------------------------------------
// TEST 4: Tìm đường khi camera đứng gần mạng waypoint
// -------------------------------------------------------------
runTest('Tìm đường khi camera đứng gần mạng waypoint', () => {
  const pathfinding = new CameraPathfindingService();

  const mockScene = new THREE.Object3D();

  const waypoints = [
    { id: 'w1', name: 'W1', position: { x: 1, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w2', name: 'W2', position: { x: 4, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w3', name: 'W3', position: { x: 8, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
  ];

  const edges = [
    { id: 'e1', fromWaypointId: 'w1', toWaypointId: 'w2', direction: 'bidirectional', status: 'valid', distance: 3.0, createdAt: '', updatedAt: '' },
    { id: 'e2', fromWaypointId: 'w2', toWaypointId: 'w3', direction: 'bidirectional', status: 'valid', distance: 4.0, createdAt: '', updatedAt: '' },
  ];

  const destHotspot = {
    id: 'hDest',
    name: 'Ban Công',
    type: 'navigation',
    position: { x: 10, y: 1.6, z: 0 },
    cameraView: { configured: true, yaw: 90, pitch: 0, roll: 0 },
    createdAt: '',
    updatedAt: '',
  };

  // Camera stands at (0.5, 1.6, 0) near W1
  const cameraPos = new THREE.Vector3(0.5, 1.6, 0);
  const cameraQuat = new THREE.Quaternion();

  const result = pathfinding.findOptimalRoute(
    cameraPos,
    cameraQuat,
    destHotspot,
    [destHotspot],
    waypoints,
    [],
    mockScene,
    edges
  );

  assert.strictEqual(result.success, true, 'Tìm đường phải thành công');
  assert.strictEqual(result.mode, 'graph');
  assert.ok(result.controlPoints && result.controlPoints.length >= 4);

  // Check that path traverses w1, w2, w3 to destination
  assert.deepStrictEqual(result.waypointsOnRoute, ['w1', 'w2', 'w3']);
  console.log(`  ✓ Tuyến tìm được đi qua các Waypoint: [${result.waypointsOnRoute.join(' -> ')}]`);
});

// -------------------------------------------------------------
// TEST 5: Tìm đường khi camera đứng giữa phòng, không trùng waypoint
// -------------------------------------------------------------
runTest('Tìm đường khi camera đứng giữa phòng, không trùng waypoint (Bridge tạm thời)', () => {
  const pathfinding = new CameraPathfindingService();
  const mockScene = new THREE.Object3D();

  const waypoints = [
    { id: 'w1', name: 'W1', position: { x: 2, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w2', name: 'W2', position: { x: 6, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
  ];

  const edges = [
    { id: 'e1', fromWaypointId: 'w1', toWaypointId: 'w2', direction: 'bidirectional', status: 'valid', distance: 4.0, createdAt: '', updatedAt: '' },
  ];

  const destHotspot = {
    id: 'hDest',
    name: 'Bếp',
    type: 'navigation',
    position: { x: 8, y: 1.6, z: 0 },
    cameraView: { configured: true, yaw: 180, pitch: -5, roll: 0 },
    createdAt: '',
    updatedAt: '',
  };

  // Camera standing off to the side at (0.0, 1.6, 1.5), not on any waypoint
  const cameraPos = new THREE.Vector3(0.0, 1.6, 1.5);
  const cameraQuat = new THREE.Quaternion();

  const result = pathfinding.findOptimalRoute(
    cameraPos,
    cameraQuat,
    destHotspot,
    [destHotspot],
    waypoints,
    [],
    mockScene,
    edges
  );

  assert.strictEqual(result.success, true);
  // Start of curve must match exact camera position
  assert.strictEqual(result.controlPoints[0].x, 0.0);
  assert.strictEqual(result.controlPoints[0].y, 1.6);
  assert.strictEqual(result.controlPoints[0].z, 1.5);

  // End of curve must match exact hotspot destination position
  const lastPt = result.controlPoints[result.controlPoints.length - 1];
  assert.strictEqual(lastPt.x, 8.0);
  assert.strictEqual(lastPt.y, 1.6);
  assert.strictEqual(lastPt.z, 0.0);

  console.log(`  ✓ Đoạn nối tạm thời (0.0, 1.6, 1.5) -> W1 -> W2 -> Bếp được ghép mượt mà`);
});

// -------------------------------------------------------------
// TEST 6: Xử lý camera ở khu vực không kết nối được với graph (BLOCKED_BY_GEOMETRY)
// -------------------------------------------------------------
runTest('Xử lý camera ở khu vực bị cô lập / phòng kín không kết nối được', () => {
  const pathfinding = new CameraPathfindingService();

  // Create scene with wall meshes
  const mockScene = new THREE.Object3D();
  const wallGeo = new THREE.BoxGeometry(0.2, 3.0, 10.0);
  const wallMat = new THREE.MeshBasicMaterial();
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.name = 'ConcreteWall';
  wallMesh.position.set(1.0, 1.5, 0.0); // Wall at x = 1.0
  wallMesh.updateMatrixWorld(true);
  mockScene.add(wallMesh);

  const waypoints = [
    { id: 'w1', name: 'W1', position: { x: 5, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
  ];

  const destHotspot = {
    id: 'hDest',
    name: 'Phòng Ngủ',
    type: 'navigation',
    position: { x: 8, y: 1.6, z: 0 },
    cameraView: { configured: true, yaw: 0, pitch: 0, roll: 0 },
    createdAt: '',
    updatedAt: '',
  };

  // Camera is on the other side of the wall at (0.0, 1.6, 0.0) with no line-of-sight
  const cameraPos = new THREE.Vector3(0.0, 1.6, 0.0);
  const cameraQuat = new THREE.Quaternion();

  const result = pathfinding.findOptimalRoute(
    cameraPos,
    cameraQuat,
    destHotspot,
    [destHotspot],
    waypoints,
    [],
    mockScene,
    []
  );

  assert.strictEqual(result.success, false, 'Phải từ chối tìm đường khi bị tường chắn');
  assert.strictEqual(result.reason, 'BLOCKED_BY_GEOMETRY');
  assert.ok(result.message && result.message.includes('tường/vật cản'));

  console.log(`  ✓ Báo lỗi an toàn: "${result.message.slice(0, 75)}..."`);
});

// -------------------------------------------------------------
// TEST 7: Tìm đường đến hotspot ở khu vực khác qua chuỗi edges
// -------------------------------------------------------------
runTest('Tìm đường đến hotspot ở khu vực khác qua chuỗi edges', () => {
  const pathfinding = new CameraPathfindingService();
  const mockScene = new THREE.Object3D();

  // Network: W1 (0,0) -> W2 (3,0) -> W3 (3,5) -> W4 (7,5) -> Dest (9,5)
  const waypoints = [
    { id: 'w1', name: 'Sảnh', position: { x: 0, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w2', name: 'Ngã rẽ', position: { x: 3, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w3', name: 'Hành lang', position: { x: 3, y: 1.6, z: 5 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'w4', name: 'Cửa Master', position: { x: 7, y: 1.6, z: 5 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
  ];

  const edges = [
    { id: 'e1', fromWaypointId: 'w1', toWaypointId: 'w2', direction: 'bidirectional', status: 'valid', distance: 3.0, createdAt: '', updatedAt: '' },
    { id: 'e2', fromWaypointId: 'w2', toWaypointId: 'w3', direction: 'bidirectional', status: 'valid', distance: 5.0, createdAt: '', updatedAt: '' },
    { id: 'e3', fromWaypointId: 'w3', toWaypointId: 'w4', direction: 'bidirectional', status: 'valid', distance: 4.0, createdAt: '', updatedAt: '' },
  ];

  const destHotspot = {
    id: 'hMaster',
    name: 'Phòng Ngủ Master',
    type: 'navigation',
    position: { x: 9, y: 1.6, z: 5 },
    cameraView: { configured: true, yaw: 270, pitch: -10, roll: 0 },
    createdAt: '',
    updatedAt: '',
  };

  const cameraPos = new THREE.Vector3(0, 1.6, 0);
  const cameraQuat = new THREE.Quaternion();

  const result = pathfinding.findOptimalRoute(
    cameraPos,
    cameraQuat,
    destHotspot,
    [destHotspot],
    waypoints,
    [],
    mockScene,
    edges
  );

  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(result.waypointsOnRoute, ['w1', 'w2', 'w3', 'w4']);

  // Target orientation matches destination hotspot
  const targetEuler = new THREE.Euler().setFromQuaternion(result.targetQuaternion, 'YXZ');
  const yawDeg = (THREE.MathUtils.radToDeg(targetEuler.y) + 360) % 360;
  const pitchDeg = THREE.MathUtils.radToDeg(targetEuler.x);
  assert.ok(Math.abs(yawDeg - 270) < 0.1, `Yaw must be 270, got ${yawDeg}`);
  assert.ok(Math.abs(pitchDeg - (-10)) < 0.1, `Pitch must be -10, got ${pitchDeg}`);

  console.log(`  ✓ Chuỗi 4 chặng điều hướng chính xác. Hướng đích: Yaw = ${yawDeg.toFixed(1)}°, Pitch = ${pitchDeg.toFixed(1)}°`);
});

// -------------------------------------------------------------
// TEST 8: Kiểm tra edge một chiều và hai chiều
// -------------------------------------------------------------
runTest('Kiểm tra edge một chiều và hai chiều', () => {
  const pathfinding = new CameraPathfindingService();
  const mockScene = new THREE.Object3D();

  const waypoints = [
    { id: 'wA', name: 'WA', position: { x: 0, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
    { id: 'wB', name: 'WB', position: { x: 3, y: 1.6, z: 0 }, orientation: { mode: 'followPath' }, locked: false, dwellTimeSeconds: 0, createdAt: '', updatedAt: '' },
  ];

  // ONE-WAY EDGE: WA -> WB only!
  const edges = [
    { id: 'e1', fromWaypointId: 'wA', toWaypointId: 'wB', direction: 'unidirectional', status: 'valid', distance: 3.0, createdAt: '', updatedAt: '' },
  ];

  const graphForward = pathfinding.buildNavigationGraph([], waypoints, [], undefined, edges);
  const adjA = graphForward.adjacency.get('wA') || [];
  const adjB = graphForward.adjacency.get('wB') || [];

  assert.ok(adjA.some(e => e.toNodeId === 'wB'), 'WA phải có cạnh tới WB');
  assert.ok(!adjB.some(e => e.toNodeId === 'wA'), 'WB KHÔNG được có cạnh ngược lại tới WA');

  console.log(`  ✓ Cạnh một chiều xác nhận: WA -> WB khả dụng, WB -> WA bị chặn theo đúng topology`);
});

// -------------------------------------------------------------
// TEST 9: Di chuyển hoặc xóa waypoint đang được sử dụng
// -------------------------------------------------------------
runTest('Di chuyển hoặc xóa waypoint đang được sử dụng (Cập nhật edges & Undo/Redo)', () => {
  const graphStore = new WaypointGraphStore();
  const pathStore = new CameraPathStore();
  const history = new CommandHistory();

  const w1 = graphStore.createWaypoint('W1', { x: 0, y: 1.6, z: 0 });
  const w2 = graphStore.createWaypoint('W2', { x: 4, y: 1.6, z: 0 });
  const edge = graphStore.createEdge(w1.id, w2.id, { direction: 'bidirectional', status: 'valid' });

  assert.strictEqual(edge.distance, 4.0);

  // 1. Move W2 from x=4 to x=7 -> distance becomes 7.0m
  w2.position.x = 7.0;
  graphStore.updateWaypoint(w2);
  const updatedEdge = graphStore.getEdge(edge.id);
  assert.strictEqual(updatedEdge.distance, 7.0, 'Độ dài cạnh phải tự động cập nhật khi waypoint di chuyển');

  // 2. Associate W1 with a camera path
  const path = pathStore.createPath('Tuyến Test', 'h1', 'h2');
  path.waypointIds = [w1.id, w2.id];
  pathStore.updatePath(path);

  // 3. Delete W1 with DeleteGlobalWaypointCommand
  const delCmd = new DeleteGlobalWaypointCommand(graphStore, w1, pathStore);
  history.execute(delCmd);

  assert.strictEqual(graphStore.getWaypoint(w1.id), undefined, 'W1 phải bị xóa khỏi graph');
  assert.strictEqual(graphStore.getAllEdges().length, 0, 'Các cạnh nối tới W1 phải tự động bị xóa');
  assert.ok(!path.waypointIds.includes(w1.id), 'W1 phải được gỡ bỏ khỏi path');

  // 4. Undo deletion
  history.undo();
  assert.ok(graphStore.getWaypoint(w1.id), 'W1 phải được khôi phục sau Undo');
  assert.strictEqual(graphStore.getAllEdges().length, 1, 'Cạnh kết nối phải được khôi phục sau Undo');
  const restoredPath = pathStore.getPath(path.id);
  assert.ok(restoredPath.waypointIds.includes(w1.id), 'W1 phải được khôi phục vào path sau Undo');

  console.log(`  ✓ Di chuyển tự động cập nhật độ dài (4m -> 7m) và Xóa/Hoàn tác bảo toàn dữ liệu 100%`);
});

// -------------------------------------------------------------
// TEST 10: Lưu, tải lại và xác nhận dữ liệu chính xác (Schema v1.3.0)
// -------------------------------------------------------------
runTest('Toàn vẹn dữ liệu Schema v1.3.0 & Tương thích ngược', () => {
  const hotspotStore = new HotspotStore();
  const graphStore = new WaypointGraphStore();
  const pathStore = new CameraPathStore();

  const h1 = {
    id: 'h1',
    name: 'Phòng Khách',
    type: 'navigation',
    position: { x: 1.5, y: 1.6, z: -2.0 },
    rotation: { x: 0, y: 45, z: 0 },
    cameraView: { configured: true, yaw: 45, pitch: -10, roll: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  hotspotStore.add(h1);

  const w1 = graphStore.createWaypoint('Hành Lang W1', { x: 3.0, y: 1.6, z: -2.0 }, { zone: 'Hành Lang', floor: 1 });
  const w2 = graphStore.createWaypoint('Bếp W2', { x: 7.0, y: 1.6, z: -2.0 }, { zone: 'Bếp', floor: 1 });
  const edge = graphStore.createEdge(w1.id, w2.id, { direction: 'bidirectional', status: 'valid', costWeight: 1.2 });

  const modelMeta = {
    fileName: 'apartment.glb',
    format: 'glb',
    fileSize: 1024000,
    fingerprint: 'fp_test_123',
    boundsCenter: { x: 0, y: 0, z: 0 },
    boundsSize: { x: 20, y: 5, z: 20 },
  };

  // 1. Export JSON v1.3.0
  const jsonStr = ConfigStorageService.exportToJson(hotspotStore, modelMeta, pathStore, graphStore);
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.schemaVersion, '1.3.0', 'Schema version phải là 1.3.0');
  assert.strictEqual(parsed.waypoints.length, 2);
  assert.strictEqual(parsed.waypointEdges.length, 1);
  assert.strictEqual(parsed.waypointEdges[0].costWeight, 1.2);

  // 2. Parse & Validate
  const valResult = ConfigStorageService.validateAndParse(jsonStr, modelMeta);
  assert.strictEqual(valResult.valid, true);
  assert.strictEqual(valResult.isModelCompatible, true);
  assert.strictEqual(valResult.config.schemaVersion, '1.3.0');

  // 3. Test Backward Compatibility with v1.2.0 file
  const legacyV120Json = JSON.stringify({
    schemaVersion: '1.2.0',
    projectId: 'legacy_proj',
    projectName: 'Legacy v1.2.0 Project',
    updatedAt: new Date().toISOString(),
    modelInfo: modelMeta,
    hotspots: [h1],
    waypoints: [w1, w2],
    cameraPaths: [],
    settings: { markerOcclusion: false, showLabels: true, showIndexes: true, gridVisible: true },
  });

  const legacyResult = ConfigStorageService.validateAndParse(legacyV120Json, modelMeta);
  assert.strictEqual(legacyResult.valid, true);
  assert.strictEqual(legacyResult.config.schemaVersion, '1.3.0', 'File v1.2.0 phải được nâng cấp tự động lên 1.3.0');
  assert.ok(Array.isArray(legacyResult.config.waypointEdges), 'waypointEdges phải được khởi tạo mảng rỗng');

  console.log(`  ✓ Xuất và Nạp Schema v1.3.0 toàn vẹn 100%. Tương thích ngược file v1.2.0 thành công!`);
});

console.log('======================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} GLOBAL WAYPOINT GRAPH TESTS PASSED 100%!`);
console.log('======================================================');
