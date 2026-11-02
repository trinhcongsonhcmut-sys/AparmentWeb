import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

const idsToCheck = [
  'canvas-3d-wrapper',
  'css2d-wrapper',
  'playback-timeline-hud',
  'btn-timeline-play-pause',
  'btn-timeline-stop',
  'btn-timeline-rewind',
  'btn-timeline-loop',
  'btn-timeline-reverse',
  'timeline-slider',
  'time-current',
  'time-total',
  'panel-hotspots-content',
  'panel-camera-paths',
  'inspector-content',
  'panel-path-inspector',
  'btn-add-hotspot',
  'topbar-hotspot-actions',
  'topbar-path-actions',
  'btn-create-path-topbar',
  'btn-add-waypoint-topbar',
  'btn-preview-path-topbar',
  'tab-mode-hotspots',
  'tab-mode-paths',
  'path-select-dropdown',
  'btn-create-path-trigger',
  'btn-create-path-quick',
  'btn-add-waypoint-trigger',
  'waypoint-chain-container',
  'path-inspector-empty',
  'path-inspector-form',
  'waypoint-inspector-form',
  'prop-path-name',
  'prop-path-from',
  'prop-path-to',
  'prop-path-curve',
  'prop-path-tension',
  'val-path-tension',
  'prop-path-duration',
  'prop-path-easing',
  'path-warnings-box',
  'btn-path-reverse',
  'btn-path-duplicate',
  'btn-path-delete',
  'prop-wp-name',
  'prop-wp-pos-x',
  'prop-wp-pos-y',
  'prop-wp-pos-z',
  'btn-wp-eye-level',
  'prop-wp-orient-mode',
  'row-manual-angles',
  'prop-wp-yaw',
  'prop-wp-pitch',
  'prop-wp-dwell',
  'prop-wp-locked',
  'btn-wp-delete',
  'modal-create-path',
  'btn-close-create-path-modal',
  'btn-cancel-create-path',
  'btn-submit-create-path',
  'new-path-name',
  'new-path-from',
  'new-path-to',
  'new-path-curve',
  'new-path-duration',
  'placement-hud',
  'end-orientation-hud',
  'end-orient-hud-title',
  'hud-end-pos-x',
  'hud-end-pos-y',
  'hud-end-pos-z',
  'hud-end-yaw-val',
  'hud-end-pitch-val',
  'btn-save-end-all-hud',
  'btn-save-end-rot-hud',
  'btn-reset-end-orient-hud',
  'btn-cancel-end-orient-hud',
  'path-dest-hotspot-name',
  'btn-edit-dest-hotspot-orient',
  'prop-path-end-transition',
  'val-path-end-transition',
  'prop-path-end-easing',
  // GLOBAL WAYPOINT GRAPH DOM IDS
  'tab-mode-graph',
  'topbar-graph-actions',
  'btn-add-global-wp-topbar',
  'btn-auto-connect-topbar',
  'btn-diagnose-graph-topbar',
  'panel-graph-content',
  'graph-wp-count-badge',
  'graph-edge-count-badge',
  'btn-diagnose-graph-left',
  'graph-search-input',
  'graph-filter-select',
  'btn-add-global-wp-left',
  'graph-autoconnect-box',
  'btn-run-autoconnect',
  'prop-autoconnect-radius',
  'val-autoconnect-radius',
  'prop-autoconnect-height',
  'val-autoconnect-height',
  'graph-waypoint-list',
  'btn-toggle-graph-overlay',
  'panel-graph-inspector',
  'graph-inspector-empty',
  'graph-wp-inspector-form',
  'prop-graph-wp-name',
  'prop-graph-wp-id',
  'prop-graph-wp-zone',
  'prop-graph-wp-floor',
  'prop-graph-wp-status',
  'prop-graph-wp-pos-x',
  'prop-graph-wp-pos-y',
  'prop-graph-wp-pos-z',
  'prop-graph-wp-locked',
  'graph-wp-neighbors-list',
  'prop-graph-connect-target',
  'btn-create-edge-manual',
  'btn-graph-wp-duplicate',
  'btn-graph-wp-delete',
  'graph-edge-inspector-form',
  'prop-edge-from-name',
  'prop-edge-to-name',
  'prop-edge-direction',
  'prop-edge-status',
  'prop-edge-distance',
  'prop-edge-duration',
  'prop-edge-cost-weight',
  'btn-retest-edge-collision',
  'btn-confirm-edge-safe',
  'btn-delete-edge',
  'modal-graph-diagnostics',
  'btn-close-diagnostics-modal',
  'btn-run-full-audit',
  'diagnostics-modal-content',
  'diag-test-start',
  'diag-test-dest',
  'btn-run-test-route',
  'diag-test-result'
];

const idsRemoved = [
  'chk-path-end-custom-pos',
  'path-end-pos-fields',
  'btn-path-end-pos-current',
  'prop-path-end-pos-x',
  'prop-path-end-pos-y',
  'prop-path-end-pos-z',
  'prop-path-end-mode',
  'path-end-orient-custom-fields',
  'btn-align-end-orient-viewport',
  'prop-path-end-yaw',
  'prop-path-end-pitch',
  'prop-path-end-roll',
  'btn-reset-end-orient-to-hotspot',
  'btn-set-end-orient-topbar'
];

console.log('Checking required DOM elements by regex...');
let missing = 0;
for (const id of idsToCheck) {
  const re = new RegExp(`id=["']${id}["']`);
  if (!re.test(html)) {
    console.error(`❌ MISSING ELEMENT ID: #${id}`);
    missing++;
  }
}

let erroneouslyPresent = 0;
for (const id of idsRemoved) {
  const re = new RegExp(`id=["']${id}["']`);
  if (re.test(html)) {
    console.error(`❌ ELEMENT SHOULD BE REMOVED BUT STILL PRESENT: #${id}`);
    erroneouslyPresent++;
  }
}

if (missing === 0 && erroneouslyPresent === 0) {
  console.log(`✅ All ${idsToCheck.length} element IDs exist and all ${idsRemoved.length} deprecated path end-alignment elements are completely removed!`);
} else {
  console.log(`❌ Failures: ${missing} missing, ${erroneouslyPresent} erroneously present`);
  process.exit(1);
}
