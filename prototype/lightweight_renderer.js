(function (root, factory) {
  const api = factory(root && root.LightweightCharts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ICTLwcRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LightweightCharts) {
  'use strict';

  const instances = new WeakMap();
  const palette = {background: '#0b111b', grid: '#1c293a', text: '#91a2b8', up: '#62d4b4', down: '#f18491', violet: '#aa9aff', gold: '#e6b668', compare: '#9eafff'};
  const etClock = new Intl.DateTimeFormat('en-GB', {timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});

  function assertLibrary() {
    if (!LightweightCharts || typeof LightweightCharts.createChart !== 'function') throw new Error('Lightweight Charts 5.2.0 is unavailable');
  }

  function lineStyle(name) {
    const styles = LightweightCharts.LineStyle || {};
    return styles[name] == null ? (name === 'Dotted' ? 1 : name === 'Dashed' ? 2 : 0) : styles[name];
  }

  function formatTime(value) {
    const seconds = typeof value === 'number' ? value : Date.UTC(value.year, value.month - 1, value.day) / 1000;
    return etClock.format(new Date(seconds * 1000));
  }

  function scheduleOverlay(instance) {
    if (instance.frame) cancelAnimationFrame(instance.frame);
    instance.frame = requestAnimationFrame(() => drawOverlay(instance));
  }

  function create(container, callbacks) {
    assertLibrary();
    container.textContent = '';
    container.style.position = 'relative';
    const host = document.createElement('div');
    host.className = 'lwc-host';
    host.style.cssText = 'position:absolute;inset:0';
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'lwc-study-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden';
    container.append(host, overlay);

    const chart = LightweightCharts.createChart(host, {
      width: Math.max(300, container.clientWidth),
      height: Math.max(280, container.clientHeight),
      layout: {background: {type: 'solid', color: palette.background}, textColor: palette.text, attributionLogo: true},
      grid: {vertLines: {color: palette.grid}, horzLines: {color: palette.grid}},
      crosshair: {mode: LightweightCharts.CrosshairMode?.Normal ?? 0},
      rightPriceScale: {borderColor: '#243246', minimumWidth: 82},
      timeScale: {borderColor: '#243246', timeVisible: true, secondsVisible: false, rightOffset: 2, tickMarkFormatter: formatTime},
      localization: {priceFormatter: price => Number(price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}), timeFormatter: formatTime},
      handleScroll: true,
      handleScale: true
    });
    const candles = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: palette.up, downColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down,
      borderUpColor: palette.up, borderDownColor: palette.down, priceFormat: {type: 'price', precision: 2, minMove: 0.25}
    });
    const comparison = chart.addSeries(LightweightCharts.LineSeries, {
      color: palette.compare, lineWidth: 2, lineStyle: lineStyle('Dashed'), priceScaleId: 'comparison', lastValueVisible: false, priceLineVisible: false
    });
    chart.priceScale('comparison').applyOptions({visible: false, scaleMargins: {top: 0.12, bottom: 0.12}});

    const instance = {container, host, overlay, chart, candles, comparison, priceLines: [], scene: null, callbacks: callbacks || {}, fitKey: null, frame: null};
    const coordinateChanged = () => scheduleOverlay(instance);
    chart.timeScale().subscribeVisibleLogicalRangeChange(coordinateChanged);
    host.addEventListener('wheel', coordinateChanged, {passive: true});
    host.addEventListener('pointermove', coordinateChanged, {passive: true});
    chart.subscribeCrosshairMove(param => {
      const scene = instance.scene;
      if (!scene || param.time == null) return instance.callbacks.onHover?.(null);
      const found = scene.candles.find(candle => candle.time === param.time);
      instance.callbacks.onHover?.(found ? found.index : null);
    });
    chart.subscribeClick(param => {
      const scene = instance.scene;
      if (!scene || param.time == null) return;
      const found = scene.candles.find(candle => candle.time === param.time);
      if (found) instance.callbacks.onSelect?.(found.index);
    });
    instances.set(container, instance);
    return instance;
  }

  function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  }

  function svgElement(name, attributes, label) {
    const attrs = Object.entries(attributes).filter(([, value]) => value != null && Number.isFinite(value) || typeof value === 'string').map(([key, value]) => key + '="' + escape(value) + '"').join(' ');
    return '<' + name + ' ' + attrs + '>' + (label == null ? '' : escape(label)) + '</' + name + '>';
  }

  function drawOverlay(instance) {
    const {scene, container, overlay, chart, candles} = instance;
    if (!scene) return;
    const width = Math.max(300, container.clientWidth), height = Math.max(280, container.clientHeight);
    overlay.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const right = Math.max(30, width - 88), bottom = Math.max(30, height - 29), top = 14;
    const priceY = price => candles.priceToCoordinate(price);
    const exactX = time => chart.timeScale().timeToCoordinate(time);
    const first = scene.candles[0], last = scene.candles.at(-1);
    const firstX = first ? exactX(first.time) : null, lastX = last ? exactX(last.time) : null;
    const timeX = time => {
      const exact = exactX(time);
      if (exact != null) return exact;
      if (!first || !last || firstX == null || lastX == null || last.time === first.time) return null;
      return firstX + (time - first.time) / (last.time - first.time) * (lastX - firstX);
    };
    const line = (x1, y1, x2, y2, color, extra = {}) => svgElement('line', {x1, y1, x2, y2, stroke: color, 'stroke-width': 1, ...extra});
    const rect = (x, y, w, h, color, extra = {}) => svgElement('rect', {x, y, width: Math.max(0, w), height: Math.max(0, h), fill: color, ...extra});
    const text = (x, y, label, color, extra = {}) => svgElement('text', {x, y, fill: color, 'font-size': 9, 'font-family': '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', ...extra}, label);
    let out = '';

    if (scene.priorRange) {
      const high = priceY(scene.priorRange.high), eq = priceY(scene.priorRange.equilibrium), low = priceY(scene.priorRange.low);
      if (high != null && eq != null) out += rect(0, high, right, eq - high, palette.gold, {'fill-opacity': 0.045, 'data-overlay': 'prior-premium'});
      if (eq != null && low != null) out += rect(0, eq, right, low - eq, palette.up, {'fill-opacity': 0.035, 'data-overlay': 'prior-discount'});
    }

    scene.macros.forEach(macro => {
      const x1 = timeX(macro.startTime), x2 = timeX(Math.min(macro.endTime, last?.time || macro.endTime));
      if (x1 != null && x2 != null && x2 >= x1) {
        out += rect(x1, top, x2 - x1, bottom - top, palette.up, {'fill-opacity': 0.05, 'data-overlay': 'macro'});
        out += line(x1, top, x1, bottom, palette.up, {'stroke-opacity': 0.38, 'stroke-dasharray': '2 5'});
      }
    });

    scene.annotations.forEach(annotation => {
      const x = timeX(annotation.time);
      if (x != null) {
        out += line(x, top, x, bottom, annotation.color, {'stroke-opacity': 0.55, 'stroke-dasharray': '4 5', 'data-overlay': annotation.id});
        out += text(Math.min(right - 115, x + 5), top + 13, annotation.label, annotation.color);
      }
    });

    scene.fvgCandidates.forEach(zone => {
      const x1 = timeX(zone.startTime), x2 = timeX(zone.endTime), high = priceY(zone.high), low = priceY(zone.low), eq = priceY(zone.midpoint);
      if ([x1, x2, high, low].every(value => value != null)) {
        out += rect(x1, high, Math.max(1, x2 - x1), low - high, palette.violet, {'fill-opacity': 0.16, stroke: palette.violet, 'stroke-opacity': 0.75, 'data-overlay': zone.id});
        if (eq != null) out += line(x1, eq, x2, eq, palette.violet, {'stroke-opacity': 0.7, 'stroke-dasharray': '2 4'});
        out += text(Math.min(right - 100, x1 + 5), Math.max(top + 28, high - 7), 'FVG? · observed', palette.violet);
      }
    });

    scene.manualZones.forEach(zone => {
      const high = priceY(zone.high), low = priceY(zone.low), x1 = timeX(zone.startTime), x2 = timeX(zone.endTime);
      if ([x1, x2, high, low].every(value => value != null)) out += rect(x1, high, x2 - x1, low - high, palette.gold, {'fill-opacity': 0.1, stroke: palette.gold, 'stroke-dasharray': '4 4', 'data-overlay': zone.id});
    });

    if (scene.selectedCandleIndex != null && scene.selectedWickSide) {
      const selected = scene.candles.find(candle => candle.index === scene.selectedCandleIndex);
      if (selected) {
        const upper = scene.selectedWickSide === 'upper';
        const highPrice = upper ? selected.high : Math.min(selected.open, selected.close);
        const lowPrice = upper ? Math.max(selected.open, selected.close) : selected.low;
        if (highPrice > lowPrice) {
          const x = timeX(selected.time), high = priceY(highPrice), low = priceY(lowPrice), midpoint = priceY((highPrice + lowPrice) / 2);
          if ([x, high, low, midpoint].every(value => value != null)) {
            out += line(x, high, x, low, palette.down, {'stroke-width': 4, 'data-overlay': 'selected-wick'});
            out += line(x, midpoint, right, midpoint, palette.down, {'stroke-width': 1.5, 'stroke-dasharray': '4 3', 'data-overlay': 'wick-ce'});
          }
        }
      }
    }
    overlay.innerHTML = out;
  }

  function render(container, scene, callbacks) {
    if (!container) throw new TypeError('chart container is required');
    if (!scene || scene.schema !== 'ictlearn.chart-scene' || scene.schemaVersion !== 1) throw new TypeError('unsupported chart scene');
    const instance = instances.get(container) || create(container, callbacks);
    instance.callbacks = callbacks || instance.callbacks;
    instance.scene = scene;
    instance.chart.applyOptions({width: Math.max(300, container.clientWidth), height: Math.max(280, container.clientHeight)});
    instance.candles.setData(scene.candles.map(candle => ({time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close})));
    instance.comparison.setData(scene.comparison ? scene.comparison.values : []);
    instance.priceLines.forEach(priceLine => instance.candles.removePriceLine(priceLine));
    instance.priceLines = scene.referenceLevels.map(level => instance.candles.createPriceLine({
      price: level.price,
      color: level.color || palette.gold,
      lineWidth: level.id === 'manual' ? 2 : 1,
      lineStyle: lineStyle(level.id && level.id.endsWith('e') ? 'Dotted' : 'Dashed'),
      axisLabelVisible: true,
      title: level.label
    }));
    const fitKey = scene.session.date + '/' + scene.session.id + '/' + scene.timeframeMinutes;
    if (instance.fitKey !== fitKey) {
      instance.chart.timeScale().fitContent();
      instance.fitKey = fitKey;
    }
    container.dataset.renderer = 'lightweight';
    container.dataset.schemaVersion = String(scene.schemaVersion);
    container.dataset.candleCount = String(scene.candles.length);
    container.dataset.firstTime = scene.candles[0]?.isoTime || '';
    container.dataset.lastTime = scene.replay.cutoffISO || '';
    const overlayInventory = {levels: scene.referenceLevels.length, priorRange: Boolean(scene.priorRange), fvg: scene.fvgCandidates.length, macros: scene.macros.length, annotations: scene.annotations.length, manualZones: scene.manualZones.length, comparison: Boolean(scene.comparison), comparisonPoints: scene.comparison?.values.length || 0};
    container.dataset.overlayInventory = JSON.stringify(overlayInventory);
    const levelSummary = scene.referenceLevels.length ? ' Levels: ' + scene.referenceLevels.map(level => level.label + ' ' + level.price).join(', ') + '.' : '';
    const fvgSummary = scene.fvgCandidates.length ? ' Candidate FVG ' + scene.fvgCandidates[0].low + ' to ' + scene.fvgCandidates[0].high + '.' : '';
    container.setAttribute('aria-label', scene.instrument + ' ' + scene.session.label + ' interactive candlestick chart, ' + scene.candles.length + ' visible candles through ' + (scene.replay.cutoffISO || 'no cutoff') + '.' + levelSummary + fvgSummary + ' Use left and right arrow keys to move replay.');
    scheduleOverlay(instance);
    return {candleCount: scene.candles.length, cutoffISO: scene.replay.cutoffISO, overlayInventory};
  }

  function resize(container) {
    const instance = instances.get(container);
    if (!instance) return;
    instance.chart.applyOptions({width: Math.max(300, container.clientWidth), height: Math.max(280, container.clientHeight)});
    scheduleOverlay(instance);
  }

  function destroy(container) {
    const instance = instances.get(container);
    if (!instance) return;
    if (instance.frame) cancelAnimationFrame(instance.frame);
    instance.chart.remove();
    instances.delete(container);
    container.textContent = '';
  }

  return Object.freeze({render, resize, destroy});
});
