'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const contentTypes = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.md': 'text/markdown; charset=utf-8'};

function launchOptions() {
  const explicit = process.env.CHROME_BIN;
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = explicit || (fs.existsSync(macChrome) ? macChrome : null);
  return executablePath ? {headless: true, executablePath} : {headless: true};
}

function staticServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = path.resolve(root, '.' + pathname);
    if (!candidate.startsWith(root + path.sep) || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      response.writeHead(404, {'content-type': 'application/json'});
      response.end('{"error":"not found"}');
      return;
    }
    response.writeHead(200, {'content-type': contentTypes[path.extname(candidate)] || 'application/octet-stream'});
    fs.createReadStream(candidate).pipe(response);
  });
}

test('static page preserves SVG rollback and renders the default interactive replay without external requests', {timeout: 30000}, async t => {
  const server = staticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const port = server.address().port;
  const browser = await chromium.launch(launchOptions());
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') externalRequests.push(request.url());
  });

  await page.goto(`http://127.0.0.1:${port}/prototype/ict_notes_demo.html?renderer=svg`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.ictChartApp?.getAudit().totalBars === 180);
  const baseline = await page.evaluate(() => window.ictChartApp.getAudit());
  assert.equal(baseline.renderer, 'svg');
  assert.equal(baseline.scene.candles.length, 180);
  assert.equal(await page.locator('#price-chart').isVisible(), true);
  assert.equal(await page.locator('#price-chart .candle').count(), baseline.scene.candles.length);
  assert.equal(await page.locator('#price-chart .candle').first().getAttribute('data-index'), '0');
  assert.equal(await page.locator('#price-chart .candle').last().getAttribute('data-index'), '179');
  const svgInventory = await page.evaluate(() => {
    const scene = window.ictChartApp.getAudit().scene;
    const referenceIds = new Set(scene.referenceLevels.map(level => level.id));
    const renderedLevels = [...document.querySelectorAll('#price-chart [data-ref]')].filter(element => referenceIds.has(element.dataset.ref)).length;
    const renderedAnnotations = scene.annotations.filter(annotation => document.querySelector(`#price-chart [data-overlay="${annotation.id}"]`)).length;
    return {levels: renderedLevels, priorRange: Boolean(scene.priorRange && document.querySelector('#price-chart [data-overlay="prior-premium"]') && document.querySelector('#price-chart [data-overlay="prior-discount"]')), fvg: document.querySelectorAll('#price-chart [data-overlay="candidate-fvg"]').length, macros: document.querySelectorAll('#price-chart [data-overlay="macro"]').length, annotations: renderedAnnotations, manualZones: document.querySelectorAll('#price-chart [data-overlay="manual-zone"]').length, comparison: Boolean(document.querySelector('#price-chart [data-overlay="comparison-path"]'))};
  });

  await page.selectOption('#chart-renderer', 'lightweight');
  assert.equal(new URL(page.url()).searchParams.has('renderer'), false);
  await page.waitForFunction(() => document.querySelector('#lwc-chart')?.dataset.candleCount === '180');
  assert.equal(await page.locator('#lwc-chart').isVisible(), true);
  const svgVisibility = await page.locator('#price-chart').evaluate(element => ({hidden: element.hidden, display: getComputedStyle(element).display, rect: element.getBoundingClientRect().toJSON()}));
  assert.deepEqual(svgVisibility, {hidden: true, display: 'none', rect: {x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0}});
  assert.ok(await page.locator('#lwc-chart canvas').count() > 0, 'Lightweight Charts created canvas output');
  assert.equal(baseline.scene.fvgCandidates.length, 1);
  await page.waitForFunction(() => document.querySelectorAll('#lwc-chart [data-overlay="candidate-fvg"]').length === 1);
  const rendererAudit = await page.locator('#lwc-chart').evaluate(element => ({first: element.dataset.firstTime, last: element.dataset.lastTime, inventory: JSON.parse(element.dataset.overlayInventory), label: element.getAttribute('aria-label')}));
  assert.equal(rendererAudit.first, baseline.scene.candles[0].isoTime);
  assert.equal(rendererAudit.last, baseline.scene.candles.at(-1).isoTime);
  assert.deepEqual(rendererAudit.inventory, {...svgInventory, comparisonPoints: 0});
  assert.match(rendererAudit.label, /London H/);
  assert.match(await page.locator('#focus-level').inputValue(), /lh/);
  assert.match(await page.locator('#chart-hint').textContent(), /London H/);
  const chartBox = await page.locator('#lwc-chart').boundingBox();
  const fvgX = await page.locator('#lwc-chart [data-overlay="candidate-fvg"]').getAttribute('x');
  await page.mouse.move(chartBox.x + chartBox.width * 0.65, chartBox.y + chartBox.height * 0.5);
  await page.mouse.wheel(0, -500);
  await page.waitForFunction(previous => document.querySelector('#lwc-chart [data-overlay="candidate-fvg"]')?.getAttribute('x') !== previous, fvgX);
  await page.click('#show-timing');
  await page.waitForFunction(() => document.querySelectorAll('#lwc-chart [data-overlay="macro"]').length > 0);
  const lwcMacroCount = await page.locator('#lwc-chart [data-overlay="macro"]').count();
  await page.selectOption('#chart-renderer', 'svg');
  assert.equal(new URL(page.url()).searchParams.get('renderer'), 'svg');
  assert.equal(await page.locator('#price-chart [data-overlay="macro"]').count(), lwcMacroCount);
  await page.selectOption('#chart-renderer', 'lightweight');
  assert.equal(new URL(page.url()).searchParams.has('renderer'), false);
  await page.waitForFunction(() => document.querySelector('#lwc-chart')?.dataset.candleCount === '180');
  await page.click('#open-drawings');
  await page.fill('#user-label', 'Browser parity level');
  await page.fill('#user-pd-level', '29650.25');
  await page.fill('#user-fvg-high', '29660.00');
  await page.fill('#user-fvg-low', '29655.00');
  await page.click('#drawing-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('#lwc-chart [data-overlay="manual-zone"]').length === 1);
  const manualScene = await page.evaluate(() => window.ictChartApp.getAudit().scene);
  assert.equal(manualScene.manualZones.length, 1);
  assert.equal(manualScene.referenceLevels.some(level => level.id === 'manual'), true);
  await page.locator('#lwc-chart').focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => document.querySelector('#lwc-chart')?.dataset.candleCount === '179');
  if (process.env.ICT_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.ICT_SCREENSHOT_DIR, {recursive: true});
    await page.screenshot({path: path.join(process.env.ICT_SCREENSHOT_DIR, 'interactive.png'), fullPage: true});
  }

  await page.evaluate(() => window.ictChartApp.setCursor(31));
  await page.waitForFunction(() => document.querySelector('#lwc-chart')?.dataset.candleCount === '32');
  const replay = await page.evaluate(() => window.ictChartApp.getAudit());
  assert.equal(replay.visibleBars, 32);
  assert.equal(replay.scene.candles.length, 32);
  assert.equal(replay.scene.candles.some(candle => candle.time > replay.scene.replay.cutoffTime), false);
  assert.equal((await page.locator('#jump option').allTextContents()).some(label => label.startsWith('FVG')), false, 'future FVG navigation stays hidden during early replay');
  assert.doesNotMatch(await page.locator('#active-fvg-detail').textContent(), /Candidate bounds/, 'future FVG details stay hidden during early replay');
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);

  await page.setViewportSize({width: 390, height: 844});
  const mobile = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, chartWidth: document.querySelector('#lwc-chart').getBoundingClientRect().width}));
  assert.equal(mobile.scrollWidth, mobile.clientWidth);
  assert.ok(mobile.chartWidth >= 380);

  await page.selectOption('#chart-renderer', 'svg');
  assert.equal(new URL(page.url()).searchParams.get('renderer'), 'svg');
  assert.equal(await page.locator('#price-chart').isVisible(), true);
  assert.equal(await page.locator('#price-chart .candle').count(), replay.scene.candles.length);
  if (process.env.ICT_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ICT_SCREENSHOT_DIR, 'svg.png'), fullPage: true});

  await page.goto(`http://127.0.0.1:${port}/prototype/ict_notes_demo.html`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#lwc-chart')?.dataset.candleCount === '180');
  assert.equal((await page.evaluate(() => window.ictChartApp.getAudit())).renderer, 'lightweight');
  await page.locator('#journal-notes').evaluate((element, value) => {element.value = value; element.dispatchEvent(new Event('input', {bubbles: true}));}, 'Renderer migration note persists');
  await page.waitForTimeout(350);
  await page.reload({waitUntil: 'networkidle'});
  assert.equal(await page.locator('#journal-notes').inputValue(), 'Renderer migration note persists');
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
});

test('missing interactive dependency restores the preserved SVG with a visible reason', {timeout: 30000}, async t => {
  const server = staticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const browser = await chromium.launch(launchOptions());
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 900, height: 650}});
  await page.route('**/vendor/lightweight-charts.standalone.production.js', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/prototype/ict_notes_demo.html`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.ictChartApp?.getAudit().renderer === 'svg');
  assert.equal(await page.locator('#price-chart').isVisible(), true);
  assert.match(await page.locator('#navigation-status').textContent(), /preserved SVG restored/i);
});
