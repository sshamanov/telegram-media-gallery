/**
 * Settings management module.
 * Handles user preferences stored in localStorage.
 * Extracted from src-reference/main.js lines 19–103.
 *
 * See kilo-dev-process.md § 5.3 for extraction notes.
 */

/** @type {{ desktop: AppSettings, mobile: AppSettings }} */
export const DEFAULT_SETTINGS = {
  desktop: {
    thumbnails: 5000,
    fullImages: 500,
    maxSizeMB: 500,
    gridColumns: 8,
    gridOptions: [4, 8, 16],
  },
  mobile: {
    thumbnails: 1000,
    fullImages: 100,
    maxSizeMB: 200,
    gridColumns: 2,
    gridOptions: [1, 2, 4],
  },
};

/**
 * Detect whether the current device is mobile.
 * @returns {boolean}
 */
export function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
}

/**
 * Get current settings, merged with device-appropriate defaults.
 * @returns {AppSettings}
 */
export function getSettings() {
  const saved = localStorage.getItem('cacheSettings');
  const defaults = isMobileDevice() ? DEFAULT_SETTINGS.mobile : DEFAULT_SETTINGS.desktop;
  if (saved) {
    return { ...defaults, ...JSON.parse(saved) };
  }
  return { ...defaults };
}

/**
 * Persist settings to localStorage.
 * @param {AppSettings} settings
 */
export function saveSettings(settings) {
  localStorage.setItem('cacheSettings', JSON.stringify(settings));
}

/**
 * Get available grid column options for the current device.
 * @returns {number[]}
 */
export function getGridOptions() {
  return isMobileDevice() ? DEFAULT_SETTINGS.mobile.gridOptions : DEFAULT_SETTINGS.desktop.gridOptions;
}

/**
 * Get the currently active grid column count.
 * @returns {number}
 */
export function getGridColumns() {
  const saved = localStorage.getItem('gridColumns');
  if (saved) return parseInt(saved);
  return getSettings().gridColumns;
}

/**
 * Persist and apply a new grid column count.
 * @param {number} columns
 */
export function setGridColumns(columns) {
  localStorage.setItem('gridColumns', columns.toString());
  applyGridColumns(columns);
}

/**
 * Apply grid column count to the photos grid DOM element.
 * @param {number} columns
 */
export function applyGridColumns(columns) {
  const grid = document.getElementById('photos-grid');
  if (grid) {
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  }
}

/**
 * Cycle through available grid column options and apply the next one.
 */
export function cycleGridZoom() {
  const options = getGridOptions();
  const current = getGridColumns();
  const currentIndex = options.indexOf(current);
  const nextIndex = (currentIndex + 1) % options.length;
  setGridColumns(options[nextIndex]);
  updateZoomButtonLabel();
}

/**
 * Sync the zoom button label to the current column count.
 */
export function updateZoomButtonLabel() {
  const btn = document.getElementById('zoom-grid');
  if (btn) {
    btn.textContent = `${getGridColumns()}x`;
  }
}
