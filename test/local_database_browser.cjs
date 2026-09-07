'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');

const repository = path.resolve(__dirname, '..');
const serverScript = path.join(repository, 'tools', 'serve_local_chart.py');
const database = path.resolve(repository, '..', 'nq_ohlc_data.db');

function launchOptions() {
  for (const executablePath of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ]) {
    if (fs.existsSync(executablePath)) return {headless: true, executablePath};
  }
  return {headless: true};
}

function startServer() {
  const child = spawn('python3', [serverScript, '--port', '0'], {
    cwd: repository,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const ready = new Promise((resolve, reject) => {
    let stdout = '';
    const timer = setTimeout(() => reject(new Error(`Local chart server did not start. ${stderr}`)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const match = stdout.match(/Chart preview: (http:\/\/127\.0\.0\.1:\d+\/prototype\/ict_notes_demo\.html)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Local chart server exited with ${code}. ${stderr}`));
    });
  });
  return {child, ready, stderr: () => stderr};
}

test('local chart loads the selected NQ lunch session from the read-only database', {
  skip: !fs.existsSync(database),
  timeout: 45000
}, async t => {
  const server = startServer();
  t.after(() => server.child.kill('SIGTERM'));
  const base = await server.ready;

  const api = new URL('/api/ict/session', base);
  api.searchParams.set('date', '2026-09-04');
  api.searchParams.set('session', 'lunch');
  api.searchParams.set('timeframe', '1');
  const response = await fetch(api);
  const dataset = await response.json();
  assert.equal(response.ok, true, JSON.stringify(dataset));
  assert.equal(dataset.date, '2026-09-04');
  assert.equal(dataset.session, 'lunch');
  assert.equal(dataset.timeframe, 1);
  assert.equal(dataset.sourceMinutes, 120);
  assert.equal(dataset.bars.length, 120);

  const browser = await chromium.launch(launchOptions());
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1280, height: 820}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const url = new URL(base);
  url.search = 'date=2026-09-04&session=lunch&timeframe=1';
  await page.goto(url.href, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.ictChartApp?.getAudit().dataMode === 'api');
  const audit = await page.evaluate(() => window.ictChartApp.getAudit());
  assert.equal(audit.dataMode, 'api');
  assert.equal(audit.date, '2026-09-04');
  assert.equal(audit.session, 'lunch');
  assert.equal(audit.timeframe, 1);
  assert.equal(audit.totalBars, dataset.bars.length);
  assert.equal(audit.scene.candles[0].open, dataset.bars[0].o);
  assert.equal(audit.scene.candles.at(-1).close, dataset.bars.at(-1).c);
  assert.match(await page.locator('#data-footer').textContent(), /NQ read-only database/);
  assert.equal(await page.locator('#lwc-chart').getAttribute('data-candle-count'), '120');
  assert.deepEqual(errors, []);
  if (process.env.ICT_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.ICT_SCREENSHOT_DIR, {recursive: true});
    await page.screenshot({
      path: path.join(process.env.ICT_SCREENSHOT_DIR, 'nq-2026-09-04-lunch-1m.png'),
      fullPage: true
    });
  }

  await page.locator('#trade-date').fill('2026-09-03');
  await page.locator('#trade-date').dispatchEvent('change');
  await page.waitForFunction(() => window.ictChartApp.getAudit().date === '2026-09-03');
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-09-03');
  await page.click('#next-date');
  await page.waitForFunction(() => window.ictChartApp.getAudit().date === '2026-09-04');
  await page.click('#previous-date');
  await page.waitForFunction(() => window.ictChartApp.getAudit().date === '2026-09-03');
  await page.click('#latest-date');
  await page.waitForFunction(() => window.ictChartApp.getAudit().date === '2026-09-04');
  await page.selectOption('#trading-session', 'london');
  await page.waitForFunction(() => window.ictChartApp.getAudit().session === 'london');
  await page.selectOption('#chart-timeframe', '5');
  await page.waitForFunction(() => {
    const current = window.ictChartApp.getAudit();
    return current.session === 'london' && current.timeframe === 5 && current.totalBars === 36;
  });
  assert.equal(new URL(page.url()).searchParams.get('session'), 'london');
  assert.equal(new URL(page.url()).searchParams.get('timeframe'), '5');

  const directAsset = await fetch(new URL('/prototype/chart_scene_adapter.js', base));
  assert.equal(directAsset.ok, true);
  assert.match(directAsset.headers.get('content-type') || '', /javascript/);
  const traversal = await fetch(new URL('/prototype/../../nq_ohlc_data.db', base));
  assert.equal(traversal.status, 404);
});
