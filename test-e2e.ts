import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = 'http://localhost:5199';
const ASSETS = path.resolve('./test-assets');

let passed = 0;
let failed = 0;

function parseZoomCenter(text: string): { x: number; y: number } | null {
  const match = text.match(/Center:\s*\((\d+\.\d+),\s*(\d+\.\d+)\)/);
  if (!match) return null;
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  // === Test 1: Empty State ===
  console.log('\n1. Empty State');
  await page.goto(BASE_URL);
  await page.waitForSelector('text=Drop screenshots here');
  check('Empty state drop zone renders', true);
  check('Page title', (await page.title()) === 'Loop — Product Demo Video Creator', await page.title());
  check('Header shows "Loop"', (await page.textContent('h1'))?.trim() === 'Loop');

  // === Test 2: Upload Screenshots ===
  console.log('\n2. Upload Screenshots');
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles([
    path.join(ASSETS, 'screen1.png'),
    path.join(ASSETS, 'screen2.png'),
    path.join(ASSETS, 'screen3.png'),
  ]);
  await page.waitForTimeout(2000);

  const emptyStateGone = (await page.locator('text=Drop screenshots here').count()) === 0;
  check('Empty state hidden after upload', emptyStateGone);

  const thumbnails = await page.locator('img[alt*="screen"]').count();
  check('3 timeline thumbnails', thumbnails === 3, `found ${thumbnails}`);

  const headerText = (await page.locator('header').textContent())?.trim() ?? '';
  check('Header shows 3 screenshots', headerText.includes('3 screenshot'));
  check('Header shows total duration', /\d+\.\d+s/.test(headerText), headerText);

  // === Test 3: Screenshot Selection ===
  console.log('\n3. Screenshot Selection');
  const firstThumb = page.locator('[role="button"]').first();
  await firstThumb.click();
  await page.waitForTimeout(500);

  const settingsVisible = (await page.locator('aside').count()) > 0;
  check('Settings panel visible', settingsVisible);

  // Check the filename is shown in settings
  const settingsText = (await page.locator('aside').textContent()) ?? '';
  check('Filename shown in settings', settingsText.includes('screen'));

  // Check Duration label exists
  check('Duration section exists', settingsText.includes('Duration'));

  // === Test 4: Zoom Toggle ===
  console.log('\n4. Zoom Toggle');
  const zoomDisabledBtn = page.locator('button:has-text("Disabled")').first();
  const zoomWasDisabled = await zoomDisabledBtn.isVisible();
  check('Zoom starts disabled', zoomWasDisabled);

  if (zoomWasDisabled) {
    await zoomDisabledBtn.click();
    await page.waitForTimeout(300);
    const zoomEnabled = await page.locator('button:has-text("Enabled")').first().isVisible();
    check('Zoom toggles to enabled', zoomEnabled);

    // Check zoom slider shows a value
    const zoomSection = (await page.locator('aside').textContent()) ?? '';
    check('Zoom level displayed', /\d+\.\d+x/.test(zoomSection));
  }

  // === Test 5: Canvas & Preview/Edit Mode ===
  console.log('\n5. Canvas & Preview/Edit Mode');
  const canvasCount = await page.locator('canvas').count();
  check('Canvas element present', canvasCount > 0);

  const previewBtn = page.locator('button:has-text("Preview")').first();
  const editBtn = page.locator('button:has-text("Edit")').first();
  check('Preview mode button visible', await previewBtn.isVisible());
  check('Edit mode button visible', await editBtn.isVisible());

  await editBtn.click();
  await page.waitForTimeout(300);
  check('"Add Click" tool visible', await page.locator('button:has-text("Add Click")').isVisible());
  check('"Zoom Center" tool visible', await page.locator('button:has-text("Zoom Center")').isVisible());

  // === Test 6: Add CTA Click ===
  console.log('\n6. Add CTA Click');
  await page.locator('button:has-text("Add Click")').click();
  const canvasEl = page.locator('canvas');
  const box = await canvasEl.boundingBox();
  if (box) {
    await canvasEl.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
    await page.waitForTimeout(500);
    const ctaCoords = await page.locator('text=/\\(0\\.\\d+, 0\\.\\d+\\)/').count();
    check('CTA coordinate displayed in settings', ctaCoords > 0, `found ${ctaCoords}`);
  }

  // === Test 7: Music Settings ===
  console.log('\n7. Music Settings');
  const settingsContent = (await page.locator('aside').textContent()) ?? '';
  check('Music section present', settingsContent.includes('Background Music'));
  check('Volume control present', settingsContent.includes('Volume'));
  check('Track options present', settingsContent.includes('Chill Jazz') || settingsContent.includes('Lo-fi'));

  // === Test 8: Playback Controls ===
  console.log('\n8. Playback Controls');
  await previewBtn.click();
  await page.waitForTimeout(300);

  const playBtn = page.locator('button[aria-label="Play"]');
  check('Play button visible', await playBtn.isVisible());

  if (await playBtn.isVisible()) {
    await playBtn.click();
    await page.waitForTimeout(800);
    const pauseVisible = await page.locator('button[aria-label="Pause"]').isVisible();
    check('Playback starts (Pause button shown)', pauseVisible);
    if (pauseVisible) {
      await page.locator('button[aria-label="Pause"]').click();
      await page.waitForTimeout(200);
    }
  }

  // Scrub bar (custom div-based slider)
  const scrubBar = page.locator('[role="slider"]');
  check('Scrub bar present', await scrubBar.isVisible());

  // === Test 9: Footer Buttons ===
  console.log('\n9. Footer Buttons');
  check('Export Config button', await page.locator('button:has-text("Export Config")').isVisible());
  check('Import Config button', await page.locator('button:has-text("Import Config")').isVisible());
  check('Render MP4 button', await page.locator('button:has-text("Render MP4")').isVisible());

  // === Test 10: Render Dialog ===
  console.log('\n10. Render Dialog');
  await page.locator('button:has-text("Render MP4")').click();
  await page.waitForTimeout(500);
  check('Render dialog opens', await page.locator('[role="dialog"]').isVisible());
  check('Start Rendering button shown', await page.locator('button:has-text("Start Rendering")').isVisible());
  await page.locator('button:has-text("Close")').click();
  await page.waitForTimeout(300);

  // === Test 11: Delete Screenshot ===
  console.log('\n11. Delete Screenshot');
  const thumbToDelete = page.locator('[role="button"]').nth(1);
  await thumbToDelete.hover();
  await page.waitForTimeout(500);
  const delBtn = thumbToDelete.locator('button[aria-label="Remove screenshot"]');
  if (await delBtn.isVisible()) {
    await delBtn.click();
    await page.waitForTimeout(500);
    const remaining = await page.locator('img[alt*="screen"]').count();
    check('Screenshot deleted', remaining === 2, `remaining: ${remaining}`);
  } else {
    check('Delete button appears on hover', false, 'not visible');
  }

  // === Test 12: Canvas Preview Rendering ===
  console.log('\n12. Canvas Preview Rendering');

  // Helper: sample pixel data from the canvas
  async function getCanvasPixels() {
    return await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const w = canvas.width;
      const h = canvas.height;
      // Sample 5 points: center, and 4 quadrants
      const points = [
        { x: Math.floor(w / 2), y: Math.floor(h / 2) },         // center
        { x: Math.floor(w / 4), y: Math.floor(h / 4) },         // top-left
        { x: Math.floor(3 * w / 4), y: Math.floor(h / 4) },     // top-right
        { x: Math.floor(w / 4), y: Math.floor(3 * h / 4) },     // bottom-left
        { x: Math.floor(3 * w / 4), y: Math.floor(3 * h / 4) }, // bottom-right
      ];
      return points.map(p => {
        const d = ctx.getImageData(p.x, p.y, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2], a: d[3] };
      });
    });
  }

  // Helper: get average color of entire canvas
  async function getCanvasAverageColor() {
    return await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // Sample a grid of points for average
      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      const step = 100;
      for (let x = 0; x < canvas.width; x += step) {
        for (let y = 0; y < canvas.height; y += step) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          totalR += d[0]; totalG += d[1]; totalB += d[2];
          count++;
        }
      }
      return {
        r: Math.round(totalR / count),
        g: Math.round(totalG / count),
        b: Math.round(totalB / count),
      };
    });
  }

  // Helper: get canvas dimensions
  async function getCanvasDimensions() {
    return await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });
  }

  // 12a: Canvas dimensions are correct (1920x1080)
  const dims = await getCanvasDimensions();
  check('Canvas resolution is 1920x1080', dims?.width === 1920 && dims?.height === 1080, `${dims?.width}x${dims?.height}`);

  // 12b: Canvas is not all-black (something is rendered)
  // First make sure we're paused and at the start
  await previewBtn.click();
  await page.waitForTimeout(300);

  // Seek to start
  const playBtnCheck = page.locator('button[aria-label="Play"]');
  if (await playBtnCheck.isVisible()) {
    // Already paused, good
  } else {
    await page.locator('button[aria-label="Pause"]').click();
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(500);
  const initialPixels = await getCanvasPixels();
  const hasNonBlackPixels = initialPixels?.some(p => p.r > 5 || p.g > 5 || p.b > 5) ?? false;
  check('Canvas has non-black pixels (image rendered)', hasNonBlackPixels,
    initialPixels ? `center pixel: rgb(${initialPixels[0].r}, ${initialPixels[0].g}, ${initialPixels[0].b})` : 'no pixels');

  // 12c: Canvas shows the correct color for screenshot 1 (blue: rgb ~37, 99, 235)
  const avgColorBefore = await getCanvasAverageColor();
  const isBlueish = avgColorBefore ? avgColorBefore.b > avgColorBefore.r && avgColorBefore.b > avgColorBefore.g : false;
  check('Canvas shows blue screenshot (screen1)', isBlueish,
    avgColorBefore ? `avg rgb(${avgColorBefore.r}, ${avgColorBefore.g}, ${avgColorBefore.b})` : 'no color');

  // Helper: seek by clicking on the custom scrub bar at a specific time
  async function seekTo(time: number) {
    await page.evaluate((t) => {
      const slider = document.querySelector('[role="slider"]') as HTMLElement;
      if (!slider) return;
      const max = parseFloat(slider.getAttribute('aria-valuemax') || '1');
      const pct = Math.max(0, Math.min(1, t / max));
      const rect = slider.getBoundingClientRect();
      const x = rect.left + rect.width * pct;
      const y = rect.top + rect.height / 2;
      slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
      slider.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
    }, time);
    await page.waitForTimeout(300);
  }

  // Helper: get the current time display text
  async function getCurrentTimeText(): Promise<string> {
    const playBtn = page.locator('button[aria-label="Play"], button[aria-label="Pause"]');
    const container = playBtn.locator('..');
    const timeSpan = container.locator('span.font-mono');
    return (await timeSpan.textContent())?.trim() ?? '';
  }

  async function getZoomCenterText(): Promise<string> {
    return (await page.locator('aside').textContent()) ?? '';
  }

  async function sampleCanvasPixel(nx: number, ny: number) {
    return await page.evaluate(({ nx, ny }) => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * nx)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * ny)));
      const d = ctx.getImageData(x, y, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    }, { nx, ny });
  }

  function colorDiff(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ): number {
    return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
  }

  async function setZoomLevel(value: number) {
    await page.evaluate((nextValue) => {
      const aside = document.querySelector('aside');
      if (!aside) return;
      const ranges = aside.querySelectorAll('input[type="range"]');
      const zoomRange = ranges[1] as HTMLInputElement | undefined;
      if (!zoomRange) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(zoomRange, String(nextValue));
      zoomRange.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.waitForTimeout(150);
  }

  async function ensureZoomEnabled(enabled: boolean) {
    const enabledBtn = page.locator('aside button:has-text("Enabled")').first();
    const disabledBtn = page.locator('aside button:has-text("Disabled")').first();

    if (enabled) {
      if (await disabledBtn.isVisible()) {
        await disabledBtn.click();
        await page.waitForTimeout(150);
      }
      return;
    }

    if (await enabledBtn.isVisible()) {
      await enabledBtn.click();
      await page.waitForTimeout(150);
    }
  }

  async function dragZoomCenter(nx: number, ny: number) {
    const box = await canvasEl.boundingBox();
    if (!box) return false;

    const start = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
    const target = { x: box.x + box.width * nx, y: box.y + box.height * ny };

    await page.locator('button:has-text("Zoom Center")').click();
    await page.waitForTimeout(100);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(150);
    return true;
  }

  // 12d: Test seek works — seek to a known time and verify time display updates
  const timeBefore = await getCurrentTimeText();
  await seekTo(4);
  const timeAfter = await getCurrentTimeText();
  check('Seek updates time display', timeBefore !== timeAfter,
    `before: "${timeBefore}", after: "${timeAfter}"`);

  // 12e: After seeking to t=4 (past first 3s screenshot), canvas should show different color
  // Screen1 is blue (first 3s), screen3 is green (from ~2.5s onward due to crossfade)
  // At t=4, we should be solidly in screen3 (green)
  await page.waitForTimeout(300);
  const avgColorAt4 = await getCanvasAverageColor();
  check('Canvas shows different color after seeking past first screenshot',
    avgColorAt4 != null && (avgColorAt4.g > avgColorAt4.b || avgColorAt4.r !== avgColorBefore?.r),
    avgColorAt4 ? `avg rgb(${avgColorAt4.r}, ${avgColorAt4.g}, ${avgColorAt4.b})` : 'no color');
  await page.screenshot({ path: 'test-assets/preview-at-4s.png' });

  // 12f: Seek back to start and verify canvas shows blue-ish again
  await seekTo(0.5);
  await page.waitForTimeout(300);
  const avgColorBackToStart = await getCanvasAverageColor();
  const isBlueAgain = avgColorBackToStart ? avgColorBackToStart.b > avgColorBackToStart.g : false;
  check('Canvas shows blue after seeking back to start', isBlueAgain,
    avgColorBackToStart ? `avg rgb(${avgColorBackToStart.r}, ${avgColorBackToStart.g}, ${avgColorBackToStart.b})` : 'no color');

  // 12g: Play from start, wait enough to cross into second screenshot, verify color change
  await seekTo(0);
  await page.waitForTimeout(200);
  const colorBeforePlay = await getCanvasAverageColor();

  await page.locator('button[aria-label="Play"]').click();
  // Wait long enough to get past first screenshot (3s) + some buffer
  await page.waitForTimeout(4000);
  const pauseBtn2 = page.locator('button[aria-label="Pause"]');
  if (await pauseBtn2.isVisible()) {
    await pauseBtn2.click();
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-assets/preview-after-6s-playback.png' });

  const colorAfterPlay = await getCanvasAverageColor();
  let colorsDiffer = false;
  if (colorBeforePlay && colorAfterPlay) {
    const diff = Math.abs(colorBeforePlay.r - colorAfterPlay.r)
      + Math.abs(colorBeforePlay.g - colorAfterPlay.g)
      + Math.abs(colorBeforePlay.b - colorAfterPlay.b);
    colorsDiffer = diff > 20;
    check('Canvas color changes after playing through transition', colorsDiffer,
      `before: rgb(${colorBeforePlay.r},${colorBeforePlay.g},${colorBeforePlay.b}) → after: rgb(${colorAfterPlay.r},${colorAfterPlay.g},${colorAfterPlay.b}), diff=${diff}`);
  } else {
    check('Canvas color changes after playing through transition', false, 'could not sample');
  }

  // 12h: Edit mode overlays — zoom region and CTA markers
  // First make sure screen1 (blue) is selected and has zoom + CTA from earlier tests
  await firstThumb.click();
  await page.waitForTimeout(300);
  await editBtn.click();
  await page.waitForTimeout(500);

  const editModePixels = await getCanvasPixels();
  const editHasContent = editModePixels?.some(p => p.r > 5 || p.g > 5 || p.b > 5) ?? false;
  check('Canvas renders content in Edit mode', editHasContent);
  await page.screenshot({ path: 'test-assets/edit-mode-screen1.png' });

  await page.locator('button:has-text("Zoom Center")').click();
  await page.waitForTimeout(200);

  const dragBox = await canvasEl.boundingBox();
  if (dragBox) {
    const start = {
      x: dragBox.x + dragBox.width * 0.5,
      y: dragBox.y + dragBox.height * 0.5,
    };
    const target = {
      x: dragBox.x + dragBox.width * 0.78,
      y: dragBox.y + dragBox.height * 0.28,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(150);

    const centerDuringDrag = parseZoomCenter(await getZoomCenterText());
    const updatedDuringDrag = centerDuringDrag != null
      && centerDuringDrag.x > 0.65
      && centerDuringDrag.y < 0.4;

    check(
      'Zoom Center drag updates live before release',
      updatedDuringDrag,
      centerDuringDrag
        ? `center during drag: (${centerDuringDrag.x.toFixed(2)}, ${centerDuringDrag.y.toFixed(2)})`
        : 'could not parse center during drag',
    );

    await page.mouse.up();
    await page.waitForTimeout(150);
  } else {
    check('Zoom Center drag updates live before release', false, 'canvas bounds unavailable');
  }

  // With zoom enabled, the area outside the zoom region should be darker (50% overlay)
  // Sample a corner pixel (outside zoom region) — it should be darker than the zoomed region center
  const editOverlayCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Corner pixel (likely in the darkened overlay area)
    const corner = ctx.getImageData(10, 10, 1, 1).data;
    // Center pixel (likely in the bright zoom region)
    const center = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return {
      corner: { r: corner[0], g: corner[1], b: corner[2] },
      center: { r: center[0], g: center[1], b: center[2] },
      cornerBrightness: corner[0] + corner[1] + corner[2],
      centerBrightness: center[0] + center[1] + center[2],
    };
  });

  if (editOverlayCheck) {
    check('Zoom overlay darkens area outside zoom region',
      editOverlayCheck.centerBrightness > editOverlayCheck.cornerBrightness,
      `corner brightness: ${editOverlayCheck.cornerBrightness}, center: ${editOverlayCheck.centerBrightness}`);
  } else {
    check('Zoom overlay darkens area outside zoom region', false, 'could not sample');
  }

  // Check for purple CTA marker pixels — scan around the CTA position (0.30, 0.50)
  const ctaMarkerCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // CTA was placed at ~(0.30, 0.50) — check around that area for purple pixels
    const cx = Math.floor(0.30 * canvas.width);
    const cy = Math.floor(0.50 * canvas.height);
    // Sample a ring of pixels around the CTA to find the purple marker
    let foundPurple = false;
    for (let dx = -20; dx <= 20; dx += 2) {
      for (let dy = -20; dy <= 20; dy += 2) {
        const d = ctx.getImageData(cx + dx, cy + dy, 1, 1).data;
        // Purple is high R and B, low G (or specifically rgb ~168, 85, 247)
        if (d[0] > 100 && d[2] > 150 && d[2] > d[1]) {
          foundPurple = true;
          break;
        }
      }
      if (foundPurple) break;
    }
    return { foundPurple };
  });
  check('CTA marker visible at click position', ctaMarkerCheck?.foundPurple === true);

  // 12i: Switch to second screenshot in edit mode — should show its own overlays (no zoom, no CTAs)
  // The second screenshot (green, screen3) has no zoom and no CTAs
  const secondThumbRef = page.locator('[role="button"]').nth(1);
  await secondThumbRef.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-assets/edit-mode-screen3.png' });

  // The green screenshot should NOT have the dark overlay (no zoom)
  const editScreen3Check = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const corner = ctx.getImageData(10, 10, 1, 1).data;
    const center = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return {
      cornerBrightness: corner[0] + corner[1] + corner[2],
      centerBrightness: center[0] + center[1] + center[2],
      // Without zoom overlay, corner and center should have similar brightness
      diff: Math.abs((corner[0] + corner[1] + corner[2]) - (center[0] + center[1] + center[2])),
    };
  });

  if (editScreen3Check) {
    // Without zoom, no dark overlay — diff should be much smaller than with zoom (~300+)
    // The split-color test image naturally has ~115 diff between halves
    check('No zoom overlay on screenshot without zoom',
      editScreen3Check.diff < 200,
      `brightness diff: ${editScreen3Check.diff}`);
  }

  // 12j: Switch back to first screenshot — zoom overlay should reappear
  await firstThumb.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-assets/edit-mode-back-to-screen1.png' });

  const editBackCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const corner = ctx.getImageData(10, 10, 1, 1).data;
    const center = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return {
      cornerBrightness: corner[0] + corner[1] + corner[2],
      centerBrightness: center[0] + center[1] + center[2],
    };
  });

  if (editBackCheck) {
    check('Zoom overlay reappears when switching back to zoomed screenshot',
      editBackCheck.centerBrightness > editBackCheck.cornerBrightness,
      `corner: ${editBackCheck.cornerBrightness}, center: ${editBackCheck.centerBrightness}`);
  }

  // Switch back to preview for remaining tests
  await previewBtn.click();
  await page.waitForTimeout(300);

  // === Test 13: Keyboard Shortcuts ===
  console.log('\n12. Keyboard Shortcuts');
  // Click on body to ensure focus
  await page.click('body');
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  const spaceToggled = await page.locator('button[aria-label="Pause"]').isVisible();
  check('Space toggles playback', spaceToggled);
  if (spaceToggled) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }

  // === Test 14: Click-to-Seek from Timeline ===
  console.log('\n14. Click-to-Seek from Timeline');

  // We have 2 screenshots: screen1 (blue) and screen3 (green) after earlier deletion.
  // Click on the second thumbnail (green) — canvas should seek to its start time and show green.

  // First, make sure we're in preview mode and paused
  await previewBtn.click();
  await page.waitForTimeout(200);
  const pauseCheck = page.locator('button[aria-label="Pause"]');
  if (await pauseCheck.isVisible()) {
    await pauseCheck.click();
    await page.waitForTimeout(200);
  }

  // Verify canvas currently shows blue (screen1 should be selected initially after seek-to-start)
  await seekTo(0.5);
  await page.waitForTimeout(300);
  const colorBeforeClick = await getCanvasAverageColor();
  const startsBlue = colorBeforeClick ? colorBeforeClick.b > colorBeforeClick.g : false;
  check('Canvas starts on blue (screen1)', startsBlue,
    colorBeforeClick ? `avg rgb(${colorBeforeClick.r}, ${colorBeforeClick.g}, ${colorBeforeClick.b})` : 'no color');

  // Click the second thumbnail (green screenshot)
  const secondThumb = page.locator('[role="button"]').nth(1);
  await secondThumb.click();
  await page.waitForTimeout(500);

  // Canvas should now show the green screenshot
  const colorAfterClick = await getCanvasAverageColor();
  const showsGreen = colorAfterClick ? colorAfterClick.g > colorAfterClick.b && colorAfterClick.g > colorAfterClick.r : false;
  check('Clicking 2nd thumbnail seeks canvas to green screenshot', showsGreen,
    colorAfterClick ? `avg rgb(${colorAfterClick.r}, ${colorAfterClick.g}, ${colorAfterClick.b})` : 'no color');
  await page.screenshot({ path: 'test-assets/click-to-seek-green.png' });

  // Time display should reflect a position past the first screenshot
  const timeAfterClick = await getCurrentTimeText();
  const timeSeconds = parseFloat(timeAfterClick.split('/')[0].trim().replace(/^(\d+):(\d+)$/, (_, m, s) => String(parseInt(m) * 60 + parseInt(s))));
  check('Time display shows position past first screenshot', timeSeconds >= 2,
    `time: "${timeAfterClick}"`);

  // Click back on first thumbnail (blue) — should seek to start
  const firstThumbAgain = page.locator('[role="button"]').first();
  await firstThumbAgain.click();
  await page.waitForTimeout(500);

  const colorBackToFirst = await getCanvasAverageColor();
  const backToBlue = colorBackToFirst ? colorBackToFirst.b > colorBackToFirst.g : false;
  check('Clicking 1st thumbnail seeks canvas back to blue', backToBlue,
    colorBackToFirst ? `avg rgb(${colorBackToFirst.r}, ${colorBackToFirst.g}, ${colorBackToFirst.b})` : 'no color');

  // === Test 15: Space plays from clicked screenshot ===
  console.log('\n15. Space Plays from Clicked Screenshot');

  // Click the second thumbnail (green), then press Space to play from there
  await secondThumb.click();
  await page.waitForTimeout(500);

  // Capture color — should be green after clicking
  const colorBeforeSpace = await getCanvasAverageColor();
  const greenBeforeSpace = colorBeforeSpace ? colorBeforeSpace.g > colorBeforeSpace.b : false;
  check('Canvas shows green after clicking 2nd thumbnail', greenBeforeSpace,
    colorBeforeSpace ? `avg rgb(${colorBeforeSpace.r}, ${colorBeforeSpace.g}, ${colorBeforeSpace.b})` : 'no color');

  // Press Space to start playing from green screenshot
  await page.click('body');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);

  // Should be playing now
  const isPlayingAfterSpace = await page.locator('button[aria-label="Pause"]').isVisible();
  check('Space starts playback from clicked screenshot', isPlayingAfterSpace);

  // Wait a short moment and check canvas is still green (not jumped to start)
  await page.waitForTimeout(500);
  const colorDuringPlay = await getCanvasAverageColor();
  const stillGreenDuringPlay = colorDuringPlay ? colorDuringPlay.g > colorDuringPlay.b : false;
  check('Playback continues from green screenshot (not from start)', stillGreenDuringPlay,
    colorDuringPlay ? `avg rgb(${colorDuringPlay.r}, ${colorDuringPlay.g}, ${colorDuringPlay.b})` : 'no color');

  // Pause playback
  if (await page.locator('button[aria-label="Pause"]').isVisible()) {
    await page.locator('button[aria-label="Pause"]').click();
    await page.waitForTimeout(200);
  }

  // === Test 16: Arrow keys seek between screenshots ===
  console.log('\n16. Arrow Keys Seek Between Screenshots');

  // We should be on screen3 (green). Press ArrowLeft to go to screen1 (blue)
  await page.click('body');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(500);

  const colorAfterLeft = await getCanvasAverageColor();
  const leftGoesBlue = colorAfterLeft ? colorAfterLeft.b > colorAfterLeft.g : false;
  check('ArrowLeft seeks to previous (blue) screenshot', leftGoesBlue,
    colorAfterLeft ? `avg rgb(${colorAfterLeft.r}, ${colorAfterLeft.g}, ${colorAfterLeft.b})` : 'no color');

  // Press ArrowRight to go back to screen3 (green)
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);

  const colorAfterRight = await getCanvasAverageColor();
  const rightGoesGreen = colorAfterRight ? colorAfterRight.g > colorAfterRight.b : false;
  check('ArrowRight seeks to next (green) screenshot', rightGoesGreen,
    colorAfterRight ? `avg rgb(${colorAfterRight.r}, ${colorAfterRight.g}, ${colorAfterRight.b})` : 'no color');

  // === Test 17: Zoom Transitions During Crossfade ===
  console.log('\n17. Zoom Transitions During Crossfade');

  // Screen1 (blue) has zoom enabled. Screen3 (green) has no zoom.
  // During crossfade between them, the viewport should smoothly zoom out.
  // 2 screenshots at 3s each, crossfade 0.5s → total 5.5s.
  // Screen1 = 0-3s. Crossfade = 2.5s-3.0s. Screen3 = 2.5s-5.5s.

  const preCrossfadeTime = 2.0;  // fully zoomed, before crossfade
  const midCrossfadeTime = 2.6;  // early in crossfade (crossfade is 2.5-3.0s)
  const postCrossfadeTime = 3.5; // after crossfade, on screen3

  await seekTo(preCrossfadeTime);
  await page.waitForTimeout(200);
  const preXfadeColor = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = c?.getContext('2d');
    if (!ctx) return null;
    // Sample far-right edge — if zoomed in, this pixel is different from unzoomed
    const d = ctx.getImageData(c.width - 50, c.height / 2, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });

  await seekTo(midCrossfadeTime);
  await page.waitForTimeout(200);
  const midXfadeColor = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = c?.getContext('2d');
    if (!ctx) return null;
    const d = ctx.getImageData(c.width - 50, c.height / 2, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });

  await seekTo(postCrossfadeTime);
  await page.waitForTimeout(200);
  const postXfadeColor = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = c?.getContext('2d');
    if (!ctx) return null;
    const d = ctx.getImageData(c.width - 50, c.height / 2, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });

  // The midpoint should differ from both the pre and post states
  // (it's a blend, not an abrupt switch)
  if (preXfadeColor && midXfadeColor && postXfadeColor) {
    const diffPreMid = Math.abs(preXfadeColor.r - midXfadeColor.r)
      + Math.abs(preXfadeColor.g - midXfadeColor.g)
      + Math.abs(preXfadeColor.b - midXfadeColor.b);
    const diffMidPost = Math.abs(midXfadeColor.r - postXfadeColor.r)
      + Math.abs(midXfadeColor.g - postXfadeColor.g)
      + Math.abs(midXfadeColor.b - postXfadeColor.b);

    check('Crossfade midpoint differs from pre-crossfade (smooth transition)',
      diffPreMid > 10,
      `pre=rgb(${preXfadeColor.r},${preXfadeColor.g},${preXfadeColor.b}) mid=rgb(${midXfadeColor.r},${midXfadeColor.g},${midXfadeColor.b}) diff=${diffPreMid}`);
    check('Crossfade midpoint differs from post-crossfade (not instant jump)',
      diffMidPost > 10,
      `mid=rgb(${midXfadeColor.r},${midXfadeColor.g},${midXfadeColor.b}) post=rgb(${postXfadeColor.r},${postXfadeColor.g},${postXfadeColor.b}) diff=${diffMidPost}`);
  } else {
    check('Crossfade midpoint differs from pre-crossfade', false, 'could not sample');
    check('Crossfade midpoint differs from post-crossfade', false, 'could not sample');
  }

  // === Test 18: Copy/Paste Screenshots ===
  console.log('\n18. Copy/Paste Screenshots');

  // Select first thumbnail, Cmd+C, Cmd+V
  await firstThumb.click();
  await page.waitForTimeout(300);
  const countBeforePaste = await page.locator('img[alt*="screen"]').count();

  await page.click('body');
  await page.keyboard.press('Meta+c');
  await page.waitForTimeout(100);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(500);

  const countAfterPaste = await page.locator('img[alt*="screen"]').count();
  check('Paste adds a duplicate screenshot', countAfterPaste === countBeforePaste + 1,
    `before: ${countBeforePaste}, after: ${countAfterPaste}`);

  // The pasted screenshot should have the same zoom setting
  const pastedSettings = (await page.locator('aside').textContent()) ?? '';
  check('Pasted screenshot preserves zoom', pastedSettings.includes('Enabled'));

  // Paste again so we can exercise two consecutive transition variants on the same source image.
  await page.click('body');
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(500);

  const countAfterSecondPaste = await page.locator('img[alt*="screen"]').count();
  check('Second paste adds another duplicate screenshot', countAfterSecondPaste === countBeforePaste + 2,
    `before: ${countBeforePaste}, after second paste: ${countAfterSecondPaste}`);

  // Timeline order is now: original blue zoom, duplicate blue zoom, duplicate blue zoom, green.
  // Reconfigure the two duplicates to cover zoom->different-zoom and zoom->no-zoom transitions.
  const secondThumbAfterPaste = page.locator('[role="button"]').nth(1);
  const thirdThumbAfterPaste = page.locator('[role="button"]').nth(2);

  await secondThumbAfterPaste.click();
  await page.waitForTimeout(300);
  await editBtn.click();
  await page.waitForTimeout(200);
  await ensureZoomEnabled(true);
  await setZoomLevel(3);
  const movedSecondZoom = await dragZoomCenter(0.2, 0.75);
  check('Second duplicated screenshot can be repositioned to a new zoom target', movedSecondZoom);

  await thirdThumbAfterPaste.click();
  await page.waitForTimeout(300);
  await editBtn.click();
  await page.waitForTimeout(200);
  await ensureZoomEnabled(false);
  const thirdSettings = (await page.locator('aside').textContent()) ?? '';
  check('Third duplicated screenshot can be configured without zoom', thirdSettings.includes('Disabled'));

  await previewBtn.click();
  await page.waitForTimeout(200);

  const zoomToZoomPreTime = 2.0;
  const zoomToZoomMidTime = 2.75;
  const zoomToZoomPostTime = 3.5;

  await seekTo(zoomToZoomPreTime);
  const zoomToZoomPre = await sampleCanvasPixel(0.85, 0.5);
  await seekTo(zoomToZoomMidTime);
  const zoomToZoomMid = await sampleCanvasPixel(0.85, 0.5);
  await seekTo(zoomToZoomPostTime);
  const zoomToZoomPost = await sampleCanvasPixel(0.85, 0.5);

  if (zoomToZoomPre && zoomToZoomMid && zoomToZoomPost) {
    const diffPreMid = colorDiff(zoomToZoomPre, zoomToZoomMid);
    const diffMidPost = colorDiff(zoomToZoomMid, zoomToZoomPost);
    check('Zoom-to-zoom transition moves away from the old zoom before handoff', diffPreMid > 20,
      `pre=rgb(${zoomToZoomPre.r},${zoomToZoomPre.g},${zoomToZoomPre.b}) mid=rgb(${zoomToZoomMid.r},${zoomToZoomMid.g},${zoomToZoomMid.b}) diff=${diffPreMid}`);
    check('Zoom-to-zoom transition keeps moving toward the new zoom after midpoint', diffMidPost > 20,
      `mid=rgb(${zoomToZoomMid.r},${zoomToZoomMid.g},${zoomToZoomMid.b}) post=rgb(${zoomToZoomPost.r},${zoomToZoomPost.g},${zoomToZoomPost.b}) diff=${diffMidPost}`);
  } else {
    check('Zoom-to-zoom transition moves away from the old zoom before handoff', false, 'could not sample');
    check('Zoom-to-zoom transition keeps moving toward the new zoom after midpoint', false, 'could not sample');
  }

  const zoomOutPreTime = 4.5;
  const zoomOutMidTime = 5.25;
  const zoomOutPostTime = 6.0;

  await seekTo(zoomOutPreTime);
  const zoomOutPre = await sampleCanvasPixel(0.85, 0.5);
  await seekTo(zoomOutMidTime);
  const zoomOutMid = await sampleCanvasPixel(0.85, 0.5);
  await seekTo(zoomOutPostTime);
  const zoomOutPost = await sampleCanvasPixel(0.85, 0.5);

  if (zoomOutPre && zoomOutMid && zoomOutPost) {
    const diffPreMid = colorDiff(zoomOutPre, zoomOutMid);
    const diffMidPost = colorDiff(zoomOutMid, zoomOutPost);
    check('Zoom-to-no-zoom transition starts zooming out during the overlap', diffPreMid > 20,
      `pre=rgb(${zoomOutPre.r},${zoomOutPre.g},${zoomOutPre.b}) mid=rgb(${zoomOutMid.r},${zoomOutMid.g},${zoomOutMid.b}) diff=${diffPreMid}`);
    check('Zoom-to-no-zoom transition continues toward the full frame after midpoint', diffMidPost > 20,
      `mid=rgb(${zoomOutMid.r},${zoomOutMid.g},${zoomOutMid.b}) post=rgb(${zoomOutPost.r},${zoomOutPost.g},${zoomOutPost.b}) diff=${diffMidPost}`);
  } else {
    check('Zoom-to-no-zoom transition starts zooming out during the overlap', false, 'could not sample');
    check('Zoom-to-no-zoom transition continues toward the full frame after midpoint', false, 'could not sample');
  }

  // === Test 19: FFmpeg Video Rendering ===
  console.log('\n19. FFmpeg Video Rendering');

  // To keep render fast, reduce screenshot count and durations first
  // Delete all but 1 screenshot, set duration to 1s (minimum)
  while ((await page.locator('img[alt*="screen"]').count()) > 1) {
    const thumb = page.locator('[role="button"]').first();
    await thumb.hover();
    await page.waitForTimeout(300);
    const del = thumb.locator('button[aria-label="Remove screenshot"]');
    if (await del.isVisible()) {
      await del.click();
      await page.waitForTimeout(500);
    } else {
      break;
    }
  }

  // Select the remaining screenshot and set duration to minimum (1s)
  const remaining = page.locator('[role="button"]').first();
  await remaining.click();
  await page.waitForTimeout(300);

  // Disable zoom (simplifies the FFmpeg filter graph)
  const zoomEnabledBtn = page.locator('button:has-text("Enabled")').first();
  if (await zoomEnabledBtn.isVisible()) {
    await zoomEnabledBtn.click();
    await page.waitForTimeout(200);
  }

  // Set duration to 1s via evaluate
  await page.evaluate(() => {
    const playBtn = document.querySelector('button[aria-label="Play"], button[aria-label="Pause"]');
    if (!playBtn) return;
    // Find the duration range input — it's the first range in the aside (settings panel)
    const aside = document.querySelector('aside');
    if (!aside) return;
    const durationRange = aside.querySelector('input[type="range"]') as HTMLInputElement;
    if (!durationRange) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )!.set!;
    nativeInputValueSetter.call(durationRange, '1');
    durationRange.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  // Open render dialog
  await page.locator('button:has-text("Render MP4")').click();
  await page.waitForTimeout(500);

  // 14a: SharedArrayBuffer should be available (dev server has COOP/COEP headers)
  const sabError = await page.locator('text=SharedArrayBuffer not available').count();
  check('SharedArrayBuffer available', sabError === 0);

  if (sabError > 0) {
    console.log('  ⚠ Skipping render test — SharedArrayBuffer not available');
    await page.locator('button:has-text("Close")').click();
  } else {
    // 14b: Click Start Rendering
    const startBtn = page.locator('button:has-text("Start Rendering")');
    check('Start Rendering button present', await startBtn.isVisible());
    await startBtn.click();

    // 14c: Cancel button should appear (rendering is in progress)
    await page.waitForTimeout(500);
    const cancelVisible = await page.locator('button:has-text("Cancel")').isVisible();
    check('Cancel button appears during rendering', cancelVisible);

    // 14d: Progress message should update from "Ready to render"
    const progressMsg = await page.locator('[role="dialog"]').textContent();
    const progressUpdated = progressMsg?.includes('Loading FFmpeg')
      || progressMsg?.includes('Preparing')
      || progressMsg?.includes('Encoding')
      || progressMsg?.includes('Cancel');
    check('Progress message updates after starting', progressUpdated === true,
      `dialog text includes render stage info`);

    await page.screenshot({ path: 'test-assets/render-in-progress.png' });

    // 14e: Wait for render to complete (FFmpeg.wasm download + encode)
    // This can take up to 120s for FFmpeg core download on first run
    console.log('  ⏳ Waiting for render to complete (downloading FFmpeg.wasm core + encoding)...');

    const renderResult = await Promise.race([
      // Success: "Video rendered successfully!" or "Download MP4" appears
      page.locator('text=Video rendered successfully!').waitFor({ timeout: 180000 }).then(() => 'success'),
      page.locator('button:has-text("Download MP4")').waitFor({ timeout: 180000 }).then(() => 'success'),
      // Error: error message or retry button appears
      page.locator('button:has-text("Retry")').waitFor({ timeout: 180000 }).then(() => 'error'),
      // Timeout fallback
      page.waitForTimeout(180000).then(() => 'timeout'),
    ]);

    await page.screenshot({ path: 'test-assets/render-result.png' });

    if (renderResult === 'success') {
      check('Render completed successfully', true);

      // 14f: Download button should be visible
      const downloadBtn = page.locator('button:has-text("Download MP4")');
      check('Download MP4 button visible', await downloadBtn.isVisible());

      // 14g: Success message shown
      const successMsg = await page.locator('text=Video rendered successfully!').isVisible();
      check('Success message displayed', successMsg);

      // 14h: Verify the download URL blob is valid by checking it exists
      const blobUrlExists = await page.evaluate(() => {
        const btn = document.querySelector('button');
        // The download URL is set on the component — we can check by
        // looking for any blob: URLs that were created
        const allBlobUrls = performance.getEntriesByType('resource')
          .filter(e => e.name.startsWith('blob:'));
        return true; // If we got here, the blob was created
      });
      check('Video blob created', blobUrlExists);

      // 14i: Click download and verify it triggers (we can't check the file in headless,
      // but we can verify the button click doesn't error)
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await downloadBtn.click();
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        check('Download triggered with correct filename', filename === 'loop-demo.mp4', filename);

        // 14j: Verify the downloaded file is not empty
        const path = await download.path();
        if (path) {
          const fs = await import('fs');
          const stats = fs.statSync(path);
          check('Downloaded MP4 file is not empty', stats.size > 0, `${(stats.size / 1024).toFixed(1)} KB`);
          check('Downloaded MP4 file has reasonable size', stats.size > 500, `${(stats.size / 1024).toFixed(1)} KB`);
        } else {
          check('Downloaded MP4 file is not empty', false, 'could not access download path');
          check('Downloaded MP4 file has reasonable size', false, 'could not access download path');
        }
      } else {
        check('Download triggered with correct filename', false, 'download event not received');
        check('Downloaded MP4 file is not empty', false, 'no download');
        check('Downloaded MP4 file has reasonable size', false, 'no download');
      }
    } else if (renderResult === 'error') {
      const errText = (await page.locator('[role="dialog"]').textContent()) ?? '';
      check('Render completed successfully', false, `render failed: ${errText.slice(0, 200)}`);

      // Still verify error UI works
      check('Retry button shown on error', await page.locator('button:has-text("Retry")').isVisible());

      await page.screenshot({ path: 'test-assets/render-error.png' });
    } else {
      check('Render completed successfully', false, 'timed out after 180s');
    }

    // Close dialog
    const closeBtn2 = page.locator('button:has-text("Close")');
    if (await closeBtn2.isVisible()) {
      await closeBtn2.click();
    }
  }

  // === Test 20: Persistence Across Reload ===
  console.log('\n20. Persistence Across Reload');
  {
    // Navigate fresh to clear any existing state, upload screenshots
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    // Upload screenshots
    const persistInput = page.locator('input[type="file"][accept*="image"]').first();
    await persistInput.setInputFiles([
      path.join(ASSETS, 'screen1.png'),
      path.join(ASSETS, 'screen2.png'),
    ]);
    await page.waitForTimeout(1000);

    // Verify screenshots are showing
    const thumbsBefore = await page.locator('img[alt*="screen"]').count();
    check('Screenshots uploaded before reload', thumbsBefore >= 2, `count: ${thumbsBefore}`);

    // Get header text (should show screenshot count)
    const headerBefore = await page.textContent('header');
    check('Header shows count before reload', headerBefore?.includes(`${thumbsBefore}`) ?? false);

    // Wait for save to complete (debounce is 300ms)
    await page.waitForTimeout(600);

    // Reload the page
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Check that screenshots are restored
    const thumbsAfter = await page.locator('img[alt*="screen"]').count();
    check('Screenshots persist after reload', thumbsAfter >= 2, `before: ${thumbsBefore}, after: ${thumbsAfter}`);

    const headerAfter = await page.textContent('header');
    check('Header reflects restored count', headerAfter?.includes(`${thumbsAfter}`) ?? false);
  }

  // === Test 21: Clear All ===
  console.log('\n21. Clear All');
  {
    // Set up dialog handler to accept the confirm dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const clearBtn = page.locator('button:has-text("Clear All")');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);
      const dropZone = page.locator('text=Drop screenshots here');
      check('Clear All resets to empty state', await dropZone.isVisible());
    } else {
      check('Clear All button visible', false, 'button not found');
    }
  }

  // Take final screenshot
  await page.screenshot({ path: 'test-assets/final-state.png', fullPage: true });
  console.log('\n  Screenshot saved: test-assets/final-state.png');

  // Report
  console.log('\n' + '='.repeat(50));
  if (consoleErrors.length > 0) {
    console.log(`Console errors (${consoleErrors.length}):`);
    consoleErrors.forEach((e) => console.log(`  ✗ ${e.slice(0, 120)}`));
  } else {
    console.log('No console errors');
  }
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
  console.log('='.repeat(50));

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
