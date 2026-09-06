'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {fromSession} = require('../prototype/chart_scene_adapter.js');

const apiBase = process.env.ICT_API_BASE;
const testDate = process.env.ICT_TEST_DATE || '2026-09-04';

test('real read-only API responses adapt at 1m and 5m without changing OHLC', {skip: !apiBase, timeout: 30000}, async () => {
  for (const timeframe of [1, 5]) {
    const url = new URL('/api/ict/session', apiBase);
    url.searchParams.set('date', testDate);
    url.searchParams.set('session', 'nyam');
    url.searchParams.set('timeframe', String(timeframe));
    const response = await fetch(url);
    const body = await response.text();
    assert.equal(response.ok, true, body);
    const dataset = JSON.parse(body);
    assert.equal(dataset.timeframe, timeframe);
    assert.ok(dataset.bars.length > 0);
    const refs = dataset.previous ? [
      {id: 'lh', name: dataset.previous.label + ' H', value: dataset.previous.high, color: '#e6b668', group: 'london'},
      {id: 'll', name: dataset.previous.label + ' L', value: dataset.previous.low, color: '#e6b668', group: 'london'}
    ] : [];
    const state = {cursor: dataset.bars.length - 1, london: true, rth: false, fvg: true, timing: true, manualLine: null, manualZone: null, selected: null, wick: false};
    const scene = fromSession({dataset, state, refs, london: dataset.previous, fvg: null, comparison: null});
    assert.equal(scene.candles.length, dataset.bars.length);
    assert.equal(scene.candles[0].open, dataset.bars[0].o);
    assert.equal(scene.candles[0].high, dataset.bars[0].h);
    assert.equal(scene.candles[0].low, dataset.bars[0].l);
    assert.equal(scene.candles[0].close, dataset.bars[0].c);
    assert.equal(scene.replay.cutoffISO, dataset.bars.at(-1).t);
    assert.deepEqual(scene.sourceProvenance.sourceCounts, dataset.sourceCounts);
    assert.deepEqual(scene.sourceProvenance.sourceLabels, dataset.sourceLabels);
    assert.equal(scene.sourceProvenance.sourceBoundaryUTC, dataset.sourceBoundaryUTC);
    assert.equal(scene.sourceProvenance.sourceMinutes, dataset.sourceMinutes);
    assert.equal(scene.sourceProvenance.expectedMinutes, dataset.expectedMinutes);
    assert.equal(scene.sourceProvenance.latestSourceOpenUTC, dataset.lastUTC);
  }
});
