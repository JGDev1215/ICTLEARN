'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {fromSession} = require('../prototype/chart_scene_adapter.js');

const dataRoot = path.resolve(__dirname, '../prototype/static-data');

test('published study-day files match the catalog hashes and chart contract', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(dataRoot, 'catalog.json'), 'utf8'));
  assert.equal(catalog.schema, 'ictlearn.static-session-catalog');
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.sourceSnapshot.publishedStartDate, '2026-08-17');
  assert.equal(catalog.sourceSnapshot.publishedEndDate, '2026-09-04');
  assert.equal(Object.keys(catalog.days).length, 15);
  assert.equal(JSON.stringify(catalog).includes('/Users/'), false, 'catalog contains no workstation path');

  const observed = {};
  for (const [day, entry] of Object.entries(catalog.days)) {
    const encoded = fs.readFileSync(path.join(dataRoot, entry.path));
    assert.equal(encoded.length, entry.bytes);
    assert.equal(crypto.createHash('sha256').update(encoded).digest('hex'), entry.sha256);
    const payload = JSON.parse(encoded);
    assert.equal(payload.date, day);
    for (const [key, dataset] of Object.entries(payload.sessions)) {
      assert.equal(dataset.date, day);
      assert.ok([1, 5].includes(dataset.timeframe));
      assert.ok(dataset.bars.length > 0);
      const state = {cursor: dataset.bars.length - 1, london: true, rth: false, fvg: true, timing: true, manualLine: null, manualZone: null, selected: null, wick: false};
      const scene = fromSession({dataset, state, refs: [], london: dataset.previous, fvg: null, comparison: null});
      assert.equal(scene.candles.length, dataset.bars.length);
      (observed[key] ||= []).push(day);
    }
  }
  assert.deepEqual(observed, catalog.available);
});

