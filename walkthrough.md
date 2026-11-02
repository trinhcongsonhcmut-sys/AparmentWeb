# Walkthrough: Global Waypoint Graph Editor & Hotspot Destination Orientation

Dự án BAHA 3D đã được tích hợp hoàn chỉnh hệ thống **Global Waypoint Graph Editor** (Trình quản trị & Biên tập Mạng Waypoint Toàn Cục) kết hợp với kiến trúc **Hotspot Destination Orientation & Smooth Camera Rotation**.

---

## 1. Tóm tắt các tính năng cốt lõi của Global Waypoint Graph Editor

### A. Quản lý Waypoint Độc Lập Toàn Cục (Decoupled Waypoint Architecture)
- **Thư viện dùng chung:** Quản lý toàn bộ danh sách Waypoint độc lập với Camera Path qua [`WaypointGraphStore`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/store/WaypointGraphStore.ts).
- **CRUD & Trạng thái:** Cho phép thêm (click 3D trên sàn/mô hình), sửa tên/khu vực/tầng, di chuyển vị trí (TransformControls Gizmo trực quan), nhân bản, khóa/mở khóa và xóa. Hỗ trợ 3 trạng thái: `active` (hoạt động), `draft` (bản thảo), `disabled` (vô hiệu hóa).
- **Độc lập tuyến camera:** Waypoint chưa gán vào Camera Path nào vẫn tham gia điều hướng tự động trong Global Graph.
- **An toàn liên kết:** Khi xóa hoặc di chuyển Waypoint:
  - Tự động phát hiện và cảnh báo các Camera Path đang tham chiếu.
  - Tự động xóa các Edge nối tới Waypoint và cập nhật lại chiều dài các cạnh lân cận.
  - Hỗ trợ **Undo / Redo 100%** qua [`DeleteGlobalWaypointCommand`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/commands/DeleteGlobalWaypointCommand.ts), khôi phục nguyên vẹn cả Waypoint, các Edge và vị trí trong các Camera Path.

### B. Quản lý Kết nối & Cạnh Đồ thị (Edge Topology & Auto-Connect Proposer)
- **Mô hình Edge tường minh:** Mỗi kết nối giữa 2 Waypoint là một thực thể riêng (`WaypointEdge`) chứa `fromWaypointId`, `toWaypointId`, `direction` (`bidirectional` / `unidirectional`), `status` (`valid`, `blocked`, `untested`, `needs_confirmation`), khoảng cách `distance` (mét), thời gian dự kiến và hệ số chi phí `costWeight`.
- **Tự động đề xuất kết nối (Auto-Connect):**
  - Quét tìm các cặp Waypoint lân cận theo bán kính cấu hình (mặc định 6.0m) và giới hạn chênh lệch độ cao $\Delta Y \le 1.5\text{m}$.
  - **Kiểm tra va chạm hai chiều (Bi-directional Raycasting):** Bắn tia kiểm tra vật cản (tường, vách, cột) với bán kính an toàn (clearance radius 0.25m). Tuyệt đối **không nối mù** theo khoảng cách Euclidean nếu có tường chắn. Cạnh xuyên tường được tự động gán trạng thái `blocked` màu đỏ.
- **Biên tập thủ công:** Cho phép thêm cạnh mới bằng cách chọn 2 điểm, đảo chiều một chiều/hai chiều, đổi trạng thái an toàn, và kiểm tra lại tia va chạm (Retest) trực tiếp từ bảng thuộc tính.

### C. Hiển thị 3D Đồ Thị Mạng (3D Viewport Graph Visualizer)
- **Hiển thị trực quan theo thời gian thực:** Đồ thị mạng Waypoint được vẽ 3D với màu sắc chuẩn trực quan:
  - `valid` (xanh ngọc lục bảo `#10b981`): Đường thông thoáng an toàn.
  - `blocked` (đỏ cấm `#ef4444`): Bị tường hoặc vật cản chắn ngang.
  - `needs_confirmation` (vàng hổ phách `#f59e0b`): Cần quản trị viên xác nhận.
  - `untested` (xám bạc `#94a3b8`): Chưa kiểm tra va chạm.
- **Mũi tên định hướng một chiều (Directional Cone Arrows):** Các cạnh một chiều hiển thị rõ ràng mũi tên chỉ hướng di chuyển cho phép.
- **Tương tác trực tiếp:**
  - Nhấp chọn Waypoint: hiển thị danh sách các điểm đang kết nối lân cận (Neighbors) và làm sáng các cạnh liên đới.
  - Nhấp chọn Cạnh (Edge): mở ngay Inspector bên phải để đổi chiều, đổi trạng thái hoặc re-test tia vật cản.
  - **Nút bật/tắt lớp hiển thị (Viewport Graph Overlay Toggle):** Nút nổi tiện ích ở góc phải màn hình 3D cho phép bật/tắt mạng đồ thị trong bất kỳ chế độ làm việc nào.

### D. Tìm đường Thông minh & Cầu Nối Tạm thời (A* Navigation & Transient Bridging)
- **Thuật toán A\* tìm đường tối ưu:** Tích hợp trực tiếp vào [`CameraPathfindingService`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/services/CameraPathfindingService.ts), sử dụng heuristic khoảng cách Euclidean kết hợp phạt góc rẽ (turn angle penalty) để camera vào cua mượt mà.
- **Cầu nối tạm thời (Transient Bridge):**
  - Khi camera đứng ở bất kỳ vị trí tự do nào trong phòng: hệ thống tự động tìm Waypoint an toàn gần nhất để nối cầu (bảo đảm độ cao tầng $\le 1.5\text{m}$ và không đâm xuyên tường).
  - Tự động ưu tiên đi dọc theo hành lang Waypoint thay vì bay cắt chéo nguy hiểm qua phòng.
  - Tại điểm đến: kết nối mượt mà vào vị trí `cameraDestinationPosition` của Hotspot đích, bàn giao hướng nhìn chuẩn cho [`SmoothRotationService`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/services/SmoothRotationService.ts).
- **Báo lỗi an toàn rõ ràng:** Nếu camera bị nhốt trong phòng kín hoặc mạng Waypoint bị đứt đoạn không có đường đến đích, hệ thống báo lỗi dễ hiểu thay vì để camera bay mù đâm xuyên tường.

### E. Bộ Chẩn Đoán Mạng Toàn Cục & Mô Phỏng A\* (Network Diagnostics Suite)
- [`GraphDiagnosticsService`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/services/GraphDiagnosticsService.ts) quét toàn bộ mạng và phát hiện:
  - **Waypoint cô lập:** Điểm không có bất kỳ cạnh kết nối nào.
  - **Ốc đảo mạng (Disconnected Islands):** Các cụm đồ thị bị chia cắt bằng thuật toán duyệt BFS.
  - **Cạnh va chạm vật cản:** Quét kiểm tra lại các cạnh xem có bị đồ đạc/tường che chắn hay không.
  - **Điểm ngoài phạm vi:** Waypoint nằm quá xa bounding box của mô hình.
  - **Hotspot không thể tiếp cận:** Điểm đến không có đường nối từ mạng Waypoint.
- **Cửa sổ Chẩn đoán & Mô phỏng (`GraphDiagnosticsModal`):**
  - Hiển thị danh sách vấn đề kèm nút "Định vị 3D" để đưa camera ngay tới điểm lỗi.
  - **Bộ mô phỏng A\* tương tác:** Chọn điểm xuất phát và điểm đích để tính đường, hiển thị độ dài, thời gian và highlight vệt đường bay màu vàng trực tiếp trong không gian 3D.

### F. Toàn Vẹn Dữ Liệu Schema v1.3.0 & Tương Thích Ngược
- Nâng cấp schema cấu hình dự án lên **`1.3.0`**, bổ sung trường `waypointEdges` và trường `zone`, `floor`, `status` cho Waypoint.
- Tự động tương thích ngược 100% khi nạp các file schema cũ (`1.0.0`, `1.1.0`, `1.2.0`). Tuyệt đối không can thiệp hay ghi đè vào file mô hình GLB/USDZ gốc.

---

## 2. Chi tiết các Tệp tin Đã Cập nhật và Bổ sung

| STT | Tệp tin | Vai trò & Thay đổi chính |
| :--- | :--- | :--- |
| 1 | [`src/modules/camera-path/types/waypointGraph.types.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/types/waypointGraph.types.ts) | **[MỚI]** Khai báo kiểu dữ liệu: `WaypointEdge`, `WaypointStatus`, `EdgeDirection`, `EdgeStatus`, `AutoConnectOptions`, `GraphDiagnosticsReport`, `DisconnectedComponent`. |
| 2 | [`src/modules/camera-path/store/WaypointGraphStore.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/store/WaypointGraphStore.ts) | **[MỚI]** Store quản lý toàn bộ Waypoints và Edges, cung cấp CRUD, auto-connect có kiểm tra raycast va chạm, tự động tính lại chiều dài cạnh khi di chuyển. |
| 3 | [`src/modules/camera-path/services/GraphDiagnosticsService.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/services/GraphDiagnosticsService.ts) | **[MỚI]** Dịch vụ chẩn đoán mạng phát hiện điểm cô lập, ốc đảo mạng BFS, cạnh va chạm vật cản, điểm ngoài biên và hotspot không thể tiếp cận. |
| 4 | [`src/modules/camera-path/components/GlobalGraphVisualizer.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/components/GlobalGraphVisualizer.ts) | **[MỚI]** Đối tượng render 3D: hiển thị Waypoint, trạng thái cạnh theo màu, mũi tên 1 chiều, highlight lân cận và highlight đường dẫn mô phỏng A\*. |
| 5 | [`src/modules/camera-path/ui/GraphPanel.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/ui/GraphPanel.ts) | **[MỚI]** Giao diện Sidebar trái: danh sách Waypoint & Cạnh, bộ lọc trạng thái, thanh công cụ Tự động kết nối và nút mở Bộ Chẩn đoán. |
| 6 | [`src/modules/camera-path/ui/GraphPropertyPanel.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/ui/GraphPropertyPanel.ts) | **[MỚI]** Giao diện Sidebar phải: Inspector chi tiết để chỉnh sửa tên, tầng, khu vực, trạng thái, đảo chiều cạnh và kiểm tra lại tia va chạm (Retest). |
| 7 | [`src/modules/camera-path/ui/GraphDiagnosticsModal.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/ui/GraphDiagnosticsModal.ts) | **[MỚI]** Modal chẩn đoán toàn diện hệ thống mạng kèm công cụ mô phỏng A\* trực quan. |
| 8 | [`src/modules/camera-path/commands/DeleteGlobalWaypointCommand.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/commands/DeleteGlobalWaypointCommand.ts) | **[MỚI]** Command xóa Waypoint với cơ chế backup toàn bộ cạnh và vị trí tham chiếu trong Camera Path, bảo đảm Undo/Redo an toàn 100%. |
| 9 | [`src/modules/camera-path/store/CameraPathStore.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/store/CameraPathStore.ts) | Tách rời vòng đời Waypoint khỏi Path (xóa Path không làm mất Waypoint toàn cục), đồng bộ với `WaypointGraphStore`. |
| 10 | [`src/modules/camera-path/services/CameraPathfindingService.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/camera-path/services/CameraPathfindingService.ts) | Nâng cấp xây dựng đồ thị từ `WaypointEdge`, thuật toán A\* tích hợp phạt góc rẽ và cầu nối an toàn cho camera off-graph. |
| 11 | [`src/modules/config/services/ConfigStorageService.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/modules/config/services/ConfigStorageService.ts) | Nâng cấp xuất/nạp Schema v1.3.0, hỗ trợ tự động nâng cấp từ v1.0.0, v1.1.0 và v1.2.0. |
| 12 | [`src/core/navigation/CameraNavigator.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/core/navigation/CameraNavigator.ts) | Nạp `WaypointEdge` vào quá trình điều hướng camera tới Hotspot. |
| 13 | [`src/EditorApp.ts`](file:///Z:/01_du_an/PRJ_092_3DWeb/src/EditorApp.ts) | Tích hợp chế độ `graph`, chuyển đổi mode tab, kéo thả Gizmo Waypoint với cập nhật chiều dài cạnh tức thì, đặt điểm trên bề mặt 3D, raycast chọn cạnh và phím tắt. |
| 14 | [`index.html`](file:///Z:/01_du_an/PRJ_092_3DWeb/index.html) | Bổ sung tab Mạng Waypoint (`#tab-mode-graph`), topbar actions, panel bên trái/phải, floating overlay toggle button và modal chẩn đoán. |
| 15 | [`tests/verify_global_waypoint_graph.mjs`](file:///Z:/01_du_an/PRJ_092_3DWeb/tests/verify_global_waypoint_graph.mjs) | **[MỚI]** Bộ kiểm thử tự động 10 kịch bản bao quát toàn bộ yêu cầu của hệ thống Global Waypoint Graph. |

---

## 3. Báo cáo Kết quả Kiểm thử Toàn bộ Hệ thống (Regression Test Suite)

Tất cả các bộ kiểm thử tự động đã được thực thi và đạt **100% tỷ lệ vượt qua**:

```text
======================================================
🎉 ALL TEST SUITES PASSED WITH 100% SUCCESS:
  • DOM Element Integrity Check:         137/137 elements PASS (14 deprecated removed)
  • Global Waypoint Graph Editor Suite:   10/10 scenarios PASS
  • Smooth Camera Rotation Suite:         10/10 scenarios PASS
  • Hotspot Destination View Arch Suite:   8/8 scenarios PASS
  • Camera Path & Spline Evaluator Suite:  8/8 scenarios PASS
  • Waypoint Gizmo & Navigation Suite:     7/7 scenarios PASS
  • Editor Core & Fingerprint Suite:       4/4 scenarios PASS
------------------------------------------------------
  TOTAL VERIFIED AUTOMATED TESTS:         47/47 SCENARIOS PASSED 100%
  TYPESCRIPT COMPILATION CHECK:           0 ERRORS (EXIT CODE 0)
======================================================
```

---

## 4. Hướng dẫn Nghiệm thu Trực tiếp trên Trình duyệt

Máy chủ phát triển đang chạy sẵn sàng tại: **`http://localhost:5173/`**

### Kịch bản 1: Trải nghiệm Giao diện Quản trị Mạng Waypoint (Graph Mode)
1. Mở trình duyệt tại `http://localhost:5173/`.
2. Trên thanh chuyển chế độ (Mode Tabs) phía trên bên trái, nhấp chọn tab **"Mạng Waypoint"** (biểu tượng đồ thị mạng).
3. Quan sát giao diện:
   - **Sidebar bên trái:** Bảng quản trị mạng gồm 2 tab "Waypoints" và "Liên kết (Edges)", thanh tìm kiếm, bộ lọc trạng thái và nút "Tự động kết nối".
   - **Thanh Topbar:** Các nút thao tác "Thêm Waypoint (Click 3D)", "Tự động nối mạng", "Chẩn đoán mạng", "Bật/Tắt hiển thị đồ thị".
   - **Không gian 3D:** Hiển thị nút tròn nổi tiện ích ở cạnh phải màn hình để bật/tắt đồ thị nhanh.

### Kịch bản 2: Đặt Waypoint Mới Bằng Chuột & Tự Động Kết Nối (Auto-Connect)
1. Nhấp nút **"+ Thêm Waypoint"** trên Topbar hoặc Sidebar trái.
2. Nhấp chuột vào sàn nhà ở các vị trí khác nhau (ví dụ: Cửa chính, Hành lang, Bếp).
   - Marker hình cầu màu tím xuất hiện ngay tại điểm nhấp.
3. Bấm nút **"⚡ Quét & Nối mạng"**:
   - Hệ thống quét các điểm trong bán kính 6.0m.
   - Các cạnh kết nối xuất hiện nối giữa các Waypoint. Cạnh thông thoáng hiển thị màu xanh ngọc lục bảo (`valid`).
   - Nếu có đoạn bị tường che chắn, cạnh xuất hiện màu đỏ (`blocked`).

### Kịch bản 3: Kéo Thả Vị trí Waypoint bằng Gizmo & Tự Động Tính Chiều Dài Cạnh
1. Nhấp chọn một Waypoint trong không gian 3D hoặc trong danh sách Sidebar trái.
2. Trục tọa độ Gizmo (TransformControls) màu Đỏ-Xanh lá-Xanh dương xuất hiện tại Waypoint.
3. Kéo trục mũi tên để di chuyển Waypoint:
   - Các đường nối (Edges) co giãn theo thời gian thực.
   - Chiều dài cạnh được tự động cập nhật ngay trên bảng thông số bên phải.
4. Bấm `Ctrl+Z` (hoặc nút Hoàn tác trên Topbar): Waypoint và chiều dài cạnh quay về vị trí ban đầu tức thì.

### Kịch bản 4: Chạy Bộ Chẩn Đoán Mạng & Mô Phỏng Tìm Đường A\*
1. Nhấp nút **"🔍 Chẩn đoán"** trên Topbar.
2. Hộp thoại **"Bảng Chẩn Đoán & Kiểm Tra Mạng Waypoint"** mở ra:
   - Hiển thị thống kê tổng số Waypoint, số cạnh, trạng thái sức khỏe mạng.
   - Liệt kê các cảnh báo nếu có (Waypoint cô lập, cạnh va chạm tường).
3. Chuyển xuống phần **"Mô Phỏng Tìm Đường (A\* Simulation)"**:
   - Chọn *Điểm xuất phát (From)* và *Điểm đích (To)*.
   - Bấm **"Chạy Mô Phỏng Tìm Đường"**.
   - Hệ thống hiển thị kết quả: Độ dài tuyến đường (mét), thời gian bay dự kiến và danh sách các Waypoint trên tuyến.
   - Trong không gian 3D, tuyến đường tìm được được tô sáng màu vàng kim rực rỡ.

### Kịch bản 5: Bấm Hotspot để Điều Hướng Tự Động Theo Mạng Waypoint
1. Chuyển sang tab **"Điểm Hotspot"**.
2. Đứng ở bất kỳ góc nhìn nào, nhấp vào một Hotspot ở phòng khác:
   - Camera tự động tìm đường qua các Waypoint của mạng đồ thị để đi vòng qua tường/hành lang.
   - Khi tới gần Hotspot đích, camera chuyển hướng mượt mà và dừng lại chính xác tại góc nhìn chuẩn đã lưu của Hotspot đó.
