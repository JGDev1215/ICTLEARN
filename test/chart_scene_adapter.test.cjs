'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {fromSession, SCHEMA, VERSION} = require('../prototype/chart_scene_adapter.js');

function fixture(cursor = 2) {
  const bars = [
    {t: '2026-09-04T11:00:00Z', o: 100, h: 102, l: 99, c: 101, slot: 0, source: 'databento'},
    {t: '2026-09-04T11:02:00Z', o: 101, h: 104, l: 100, c: 103, slot: 2, source: 'yahoo'},
    {t: '2026-09-04T11:03:00Z', o: 103, h: 105, l: 102, c: 104, slot: 3, source: 'yahoo'},
    {t: '2026-09-04T11:04:00Z', o: 104, h: 106, l: 103, c: 105, slot: 4, source: 'yahoo'}
  ];
  return {
    dataset: {
      date: '2026-09-04', session: 'nyam', label: 'NY AM', window: '07:00–10:00',
      startUTC: '2026-09-04T11:00:00Z', endUTC: '2026-09-04T14:00:00Z', timeframe: 1,
      slots: 180, bars, sourceCounts: {databento: 1, yahoo: 3},
      sourceLabels: {databento: 'Databento fixed history', yahoo: 'Yahoo continuation (NQ=F)'},
      sourceBoundaryUTC: '2026-09-04T11:02:00Z', sourceMinutes: 4, expectedMinutes: 180,
      lastUTC: '2026-09-04T11:04:00Z', rthSlot: 150, macros: [[0, 2]]
    },
    state: {cursor, london: true, rth: false, fvg: true, timing: true, manualLine: null, manualZone: null, selected: null, wick: false},
    refs: [{id: 'lh', name: 'London H', value: 110, color: '#e6b668', group: 'london'}],
    london: {label: 'London', high: 110, low: 90, eq: 100, sourceMinutes: 180, expectedMinutes: 180},
    fvg: {low: 101, high: 102, formedIndex: 2, direction: 'up'},
    comparison: {
      date: '2026-09-03', session: 'nyam', label: 'NY AM', slots: 180,
      bars: [{slot: 0, o: 200, c: 200}, {slot: 90, o: 200, c: 202}, {slot: 179, o: 202, c: 204}]
    }
  };
}

test('scene contains only observed candles through the replay cursor', () => {
  const scene = fromSession(fixture(1));
  assert.equal(scene.schema, SCHEMA);
  assert.equal(scene.schemaVersion, VERSION);
  assert.equal(scene.candles.length, 2);
  assert.equal(scene.replay.totalCandles, 4);
  assert.equal(scene.replay.cutoffISO, '2026-09-04T11:02:00Z');
  assert.deepEqual(scene.missingSlots, [1]);
  assert.equal(scene.candles.some(candle => candle.isoTime > scene.replay.cutoffISO), false);
  assert.deepEqual(scene.sourceProvenance.sourceCounts, {databento: 1, yahoo: 3});
  assert.deepEqual(scene.sourceProvenance.sourceLabels, {databento: 'Databento fixed history', yahoo: 'Yahoo continuation (NQ=F)'});
  assert.equal(scene.sourceProvenance.sourceBoundaryUTC, '2026-09-04T11:02:00Z');
  assert.equal(scene.sourceProvenance.sourceMinutes, 4);
  assert.equal(scene.sourceProvenance.expectedMinutes, 180);
  assert.equal(scene.sourceProvenance.latestSourceOpenUTC, '2026-09-04T11:04:00Z');
  assert.equal(scene.annotations.some(annotation => annotation.id === 'source-boundary'), true);
  assert.equal(scene.fvgCandidates.length, 0, 'future FVG is hidden before formation');
  assert.equal(scene.comparison.values.length, 1, 'comparison is clipped to replay progress');
});

test('enabled observed overlays enter the scene after their availability time', () => {
  const input = fixture(2);
  input.state.manualLine = 103.25;
  input.state.manualZone = {low: 100.25, high: 101.25};
  input.state.manualLabel = 'Reviewed level';
  input.state.selected = 1;
  input.state.wick = true;
  input.state.wickSide = 'upper';
  const scene = fromSession(input);
  assert.equal(scene.fvgCandidates.length, 1);
  assert.equal(scene.referenceLevels.length, 2);
  assert.equal(scene.manualZones.length, 1);
  assert.equal(scene.selectedCandleIndex, 1);
  assert.equal(scene.selectedWickSide, 'upper');
  assert.ok(scene.fvgCandidates[0].formedTime <= scene.replay.cutoffTime);
});

test('invalid or unsorted OHLC data is rejected instead of repaired', () => {
  const invalidBounds = fixture();
  invalidBounds.dataset.bars[0].h = 98;
  assert.throws(() => fromSession(invalidBounds), /invalid OHLC bounds/);

  const unsorted = fixture();
  unsorted.dataset.bars[1].t = '2026-09-04T10:59:00Z';
  assert.throws(() => fromSession(unsorted), /strictly increasing/);
});

test('malformed overlay, comparison, and selection metadata is rejected', () => {
  const invalidFvg = fixture();
  invalidFvg.fvg = {low: 105, high: 102, formedIndex: 2, direction: 'up'};
  assert.throws(() => fromSession(invalidFvg), /FVG high must be above/);

  const invalidDirection = fixture();
  invalidDirection.fvg.direction = 'sideways';
  assert.throws(() => fromSession(invalidDirection), /direction must be up or down/);

  const invalidComparison = fixture();
  invalidComparison.comparison.bars[1].c = Number.NaN;
  assert.throws(() => fromSession(invalidComparison), /comparison bar 1 close must be finite/);

  const invalidMacro = fixture();
  invalidMacro.dataset.macros = [[4, 2]];
  assert.throws(() => fromSession(invalidMacro), /macro 0 is outside/);

  const invalidSelection = fixture();
  invalidSelection.state.selected = -1;
  assert.throws(() => fromSession(invalidSelection), /selected candle is outside/);

  const invalidRth = fixture();
  invalidRth.dataset.rthSlot = Number.NaN;
  assert.throws(() => fromSession(invalidRth), /RTH slot is outside/);
});
