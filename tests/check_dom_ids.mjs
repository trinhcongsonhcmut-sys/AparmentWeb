import fs from 'fs';

const html = fs.readFileSync('c:/ApartmentWeb/index.html', 'utf-8');

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
  'prop-path-end-transition',
  'prop-path-end-easing',
  'btn-reset-end-orient-to-hotspot',
  'btn-set-end-orient-topbar'
];

console.log('Checking all DOM elements by regex...');
let missing = 0;
for (const id of idsToCheck) {
  const re = new RegExp(`id=["']${id}["']`);
  if (!re.test(html)) {
    console.error(`❌ MISSING ELEMENT ID: #${id}`);
    missing++;
  }
}

if (missing === 0) {
  console.log(`✅ All ${idsToCheck.length} element IDs exist in index.html!`);
} else {
  console.log(`❌ ${missing} elements are missing!`);
}
