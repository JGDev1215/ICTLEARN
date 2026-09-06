(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ICTChartScene = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'ictlearn.chart-scene';
  const VERSION = 1;
  const TIMEZONE = 'America/New_York';
  const VALID_TIMEFRAMES = new Set([1, 5]);

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    return value;
  }

  function timestamp(value, label) {
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) throw new TypeError(label + ' must be an ISO timestamp');
    return Math.floor(milliseconds / 1000);
  }

  function normalizeCandle(bar, index, previousTime, previousSlot, totalSlots) {
    if (!bar || typeof bar !== 'object') throw new TypeError('bar ' + index + ' must be an object');
    const time = timestamp(bar.t, 'bar ' + index + ' timestamp');
    if (previousTime != null && time <= previousTime) throw new RangeError('bar timestamps must be strictly increasing');
    const open = finite(bar.o, 'bar ' + index + ' open');
    const high = finite(bar.h, 'bar ' + index + ' high');
    const low = finite(bar.l, 'bar ' + index + ' low');
    const close = finite(bar.c, 'bar ' + index + ' close');
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
      throw new RangeError('bar ' + index + ' has invalid OHLC bounds');
    }
    if (!Number.isInteger(bar.slot) || bar.slot < 0 || bar.slot >= totalSlots) throw new RangeError('bar ' + index + ' slot is outside the session');
    if (previousSlot != null && bar.slot <= previousSlot) throw new RangeError('bar slots must be strictly increasing');
    return {time, isoTime: bar.t, open, high, low, close, slot: bar.slot, source: bar.source || 'unknown', index};
  }

  function normalizeComparison(comparison, dataset, cursorBar) {
    if (!comparison || !Array.isArray(comparison.bars) || !comparison.bars.length || !cursorBar) return null;
    if (!Number.isInteger(comparison.slots) || comparison.slots <= 0) throw new RangeError('comparison slots must be a positive integer');
    const base = comparison.bars[0].o ?? comparison.bars[0].c;
    if (!Number.isFinite(base) || base === 0) throw new RangeError('comparison base must be finite and non-zero');
    const progress = Math.min(1, (cursorBar.slot + 1) / Math.max(1, dataset.slots));
    const start = timestamp(dataset.startUTC, 'session start');
    const secondsPerBar = dataset.timeframe * 60;
    const buckets = new Map();
    let previousSlot = null;
    comparison.bars.forEach((bar, index) => {
      if (!bar || !Number.isInteger(bar.slot) || bar.slot < 0 || bar.slot >= comparison.slots) throw new RangeError('comparison bar ' + index + ' slot is outside its session');
      if (previousSlot != null && bar.slot <= previousSlot) throw new RangeError('comparison bar slots must be strictly increasing');
      previousSlot = bar.slot;
      finite(bar.c, 'comparison bar ' + index + ' close');
      if ((bar.slot + 0.5) / Math.max(1, comparison.slots) > progress + 0.0001) return;
      const activeSlot = Math.min(dataset.slots - 1, Math.floor((bar.slot + 0.5) / comparison.slots * dataset.slots));
      buckets.set(activeSlot, {time: start + activeSlot * secondsPerBar, value: ((bar.c - base) / base) * 100, sourceIndex: index});
    });
    const values = [...buckets.values()].sort((left, right) => left.time - right.time);
    return values.length ? {date: comparison.date, session: comparison.session, label: comparison.label, unit: 'percent-from-open', sampling: 'last-observed-close-per-active-slot', values} : null;
  }

  function fromSession(input) {
    if (!input || typeof input !== 'object') throw new TypeError('chart scene input is required');
    const dataset = input.dataset;
    const state = input.state;
    if (!dataset || !Array.isArray(dataset.bars)) throw new TypeError('dataset.bars is required');
    if (!state || !Number.isInteger(state.cursor)) throw new TypeError('state.cursor must be an integer');
    if (!VALID_TIMEFRAMES.has(dataset.timeframe)) throw new RangeError('unsupported timeframe');
    if (!Number.isInteger(dataset.slots) || dataset.slots <= 0) throw new RangeError('dataset slots must be a positive integer');
    if (dataset.bars.length && (state.cursor < 0 || state.cursor >= dataset.bars.length)) throw new RangeError('cursor is outside the dataset');

    const visibleRaw = dataset.bars.slice(0, dataset.bars.length ? state.cursor + 1 : 0);
    let previousTime = null, previousSlot = null;
    const candles = visibleRaw.map((bar, index) => {
      const candle = normalizeCandle(bar, index, previousTime, previousSlot, dataset.slots);
      previousTime = candle.time;previousSlot = candle.slot;
      return candle;
    });
    const cursorBar = visibleRaw.at(-1) || null;
    const expectedSlots = Number.isInteger(dataset.slots) && dataset.slots >= 0 ? dataset.slots : 0;
    const presentSlots = new Set(visibleRaw.map(bar => bar.slot));
    const lastVisibleSlot = cursorBar ? cursorBar.slot : -1;
    const missingSlots = [];
    for (let slot = 0; slot <= lastVisibleSlot; slot += 1) if (!presentSlots.has(slot)) missingSlots.push(slot);

    const referenceLevels = (input.refs || [])
      .filter(ref => state[ref.group])
      .map(ref => ({id: ref.id, label: ref.name, price: finite(ref.value, 'reference price'), color: ref.color, group: ref.group}));
    if (state.manualLine != null) referenceLevels.push({id: 'manual', label: state.manualLabel + ' · user', price: finite(state.manualLine, 'manual level'), color: '#e6b668', group: 'manual'});

    if (input.fvg) {
      if (!Number.isInteger(input.fvg.formedIndex) || input.fvg.formedIndex < 2 || input.fvg.formedIndex >= dataset.bars.length) throw new RangeError('FVG formedIndex is outside the dataset');
      if (!['up', 'down'].includes(input.fvg.direction)) throw new RangeError('FVG direction must be up or down');
      finite(input.fvg.low, 'FVG low');finite(input.fvg.high, 'FVG high');
      if (input.fvg.high <= input.fvg.low) throw new RangeError('FVG high must be above FVG low');
    }
    const fvg = state.fvg && input.fvg && state.cursor >= input.fvg.formedIndex ? [{
      id: 'candidate-fvg',
      kind: 'mechanical-three-candle-gap',
      low: finite(input.fvg.low, 'FVG low'),
      high: finite(input.fvg.high, 'FVG high'),
      midpoint: (input.fvg.low + input.fvg.high) / 2,
      direction: input.fvg.direction,
      formedIndex: input.fvg.formedIndex,
      formedTime: candles[input.fvg.formedIndex]?.time,
      startTime: candles[input.fvg.formedIndex]?.time,
      endTime: candles.at(-1)?.time
    }] : [];

    const startSeconds = timestamp(dataset.startUTC, 'session start');
    const slotSeconds = dataset.timeframe * 60;
    const macros = state.timing ? (dataset.macros || []).map((pair, index) => {
      if (!Array.isArray(pair) || pair.length !== 2) throw new RangeError('macro ' + index + ' must contain start and end slots');
      const [start, finish] = pair;
      if (!Number.isFinite(start) || !Number.isFinite(finish) || start < 0 || finish <= start || finish > dataset.slots) throw new RangeError('macro ' + index + ' is outside the session');
      return {id: 'macro-' + index, startSlot: start, endSlot: finish, startTime: startSeconds + start * slotSeconds, endTime: startSeconds + finish * slotSeconds};
    }).filter(item => item.startTime <= (candles.at(-1)?.time || -Infinity)) : [];

    const annotations = [];
    if (dataset.rthSlot != null) {
      if (!Number.isFinite(dataset.rthSlot) || dataset.rthSlot < 0 || dataset.rthSlot >= dataset.slots) throw new RangeError('RTH slot is outside the session');
      const rthTime = startSeconds + dataset.rthSlot * slotSeconds;
      if (rthTime <= (candles.at(-1)?.time || -Infinity)) annotations.push({id: 'rth-open', label: '09:30 RTH', time: rthTime, color: '#62d4b4'});
    }
    if (dataset.sourceBoundaryUTC) {
      const boundaryTime = timestamp(dataset.sourceBoundaryUTC, 'source boundary');
      if (boundaryTime >= startSeconds && boundaryTime <= (candles.at(-1)?.time || -Infinity)) annotations.push({id: 'source-boundary', label: 'Yahoo continuation begins', time: boundaryTime, color: '#e6b668'});
    }

    let manualZones = [];
    if (state.manualZone) {
      const low = finite(state.manualZone.low, 'manual zone low'), high = finite(state.manualZone.high, 'manual zone high');
      if (high <= low) throw new RangeError('manual zone high must be above its low');
      manualZones = [{id: 'manual-zone', label: state.manualLabel + ' · user', low, high, startTime: candles[0]?.time, endTime: candles.at(-1)?.time}];
    }
    let previousRange = null;
    if (state.london && input.london) {
      const high = finite(input.london.high, 'prior range high'), low = finite(input.london.low, 'prior range low'), equilibrium = finite(input.london.eq, 'prior range equilibrium');
      if (high < equilibrium || equilibrium < low) throw new RangeError('prior range equilibrium must be inside its bounds');
      previousRange = {label: input.london.label, high, low, equilibrium, partial: input.london.sourceMinutes !== input.london.expectedMinutes};
    }
    const selectedCandleIndex = state.selected == null ? null : state.selected;
    if (selectedCandleIndex != null && (!Number.isInteger(selectedCandleIndex) || selectedCandleIndex < 0 || selectedCandleIndex >= dataset.bars.length)) throw new RangeError('selected candle is outside the dataset');

    return {
      schema: SCHEMA,
      schemaVersion: VERSION,
      instrument: 'NQ',
      displayTimezone: TIMEZONE,
      session: {date: dataset.date, id: dataset.session, label: dataset.label, window: dataset.window, startUTC: dataset.startUTC, endUTC: dataset.endUTC},
      timeframeMinutes: dataset.timeframe,
      expectedSlots,
      replay: {cursorIndex: state.cursor, visibleCandles: candles.length, totalCandles: dataset.bars.length, cutoffTime: candles.at(-1)?.time || null, cutoffISO: candles.at(-1)?.isoTime || null},
      candles,
      missingSlots,
      referenceLevels,
      priorRange: previousRange,
      fvgCandidates: fvg,
      macros,
      annotations,
      manualZones,
      selectedCandleIndex: selectedCandleIndex != null && selectedCandleIndex <= state.cursor ? selectedCandleIndex : null,
      selectedWickSide: state.wick ? state.wickSide : null,
      comparison: normalizeComparison(input.comparison, dataset, cursorBar),
      sourceProvenance: {
        sourceCounts: {...(dataset.sourceCounts || {})},
        sourceLabels: {...(dataset.sourceLabels || {})},
        sourceBoundaryUTC: dataset.sourceBoundaryUTC || null,
        sourceMinutes: dataset.sourceMinutes,
        expectedMinutes: dataset.expectedMinutes,
        latestSourceOpenUTC: dataset.lastUTC || null
      }
    };
  }

  return Object.freeze({SCHEMA, VERSION, fromSession});
});
