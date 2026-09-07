(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ICTStaticSessions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'ictlearn.static-session-catalog';
  const VERSION = 1;

  async function sha256(bytes) {
    if (!globalThis.crypto?.subtle) throw new Error('This browser cannot verify published study-day data.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  class StaticSessionStore {
    constructor(catalog, catalogURL, fetcher) {
      this.catalog = catalog;
      this.catalogURL = catalogURL;
      this.fetcher = (...arguments_) => fetcher(...arguments_);
      this.dayCache = new Map();
      this.meta = {...catalog.meta, static: true, publicationScope: catalog.publicationScope, sourceSnapshot: catalog.sourceSnapshot};
    }

    dates(session, timeframe) {
      return this.catalog.available[session + ':' + timeframe] || [];
    }

    resolveDate(day, session, timeframe, direction) {
      const dates = this.dates(session, timeframe);
      if (!dates.length) throw new Error('No published study days are available for this session and timeframe.');
      if (direction === 'latest') return dates.at(-1);
      if (direction === 'prev') {
        const candidate = [...dates].reverse().find(value => value < day);
        if (!candidate) throw new Error('No earlier published study day is available.');
        return candidate;
      }
      if (direction === 'next') {
        const candidate = dates.find(value => value > day);
        if (!candidate) throw new Error('No later published study day is available.');
        return candidate;
      }
      if (!dates.includes(day)) throw new Error('That date is outside the published study-day window or has no complete candles.');
      return day;
    }

    async loadDay(day) {
      if (this.dayCache.has(day)) return this.dayCache.get(day);
      const entry = this.catalog.days[day];
      if (!entry) throw new Error('Published data file is unavailable for ' + day + '.');
      if (!Number.isInteger(entry.bytes) || entry.bytes <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error('Published data metadata failed its integrity check.');
      const url = new URL(entry.path, this.catalogURL);
      if (url.origin !== this.catalogURL.origin) throw new Error('Published data file must use the catalog origin.');
      url.searchParams.set('v', entry.sha256.slice(0, 16));
      const promise = this.fetcher(url, {cache: 'force-cache'}).then(async response => {
        if (!response.ok) throw new Error('Published data file could not be loaded for ' + day + '.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== entry.bytes || await sha256(bytes) !== entry.sha256) throw new Error('Published data file failed its integrity check.');
        let payload;
        try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
        catch { throw new Error('Published data file is not valid JSON.'); }
        if (payload.schema !== 'ictlearn.static-session-day' || payload.schemaVersion !== VERSION || payload.date !== day) throw new Error('Published data file failed its schema check.');
        return payload;
      }).catch(error => {
        this.dayCache.delete(day);
        throw error;
      });
      this.dayCache.set(day, promise);
      return promise;
    }

    async getSession({day, session, timeframe, direction = ''}) {
      if (![1, 5].includes(timeframe)) throw new Error('Choose a 1-minute or 5-minute chart.');
      const resolvedDate = this.resolveDate(day, session, timeframe, direction);
      const payload = await this.loadDay(resolvedDate);
      const data = payload.sessions[session + ':' + timeframe];
      if (!data) throw new Error('No published candles are available for that date and session.');
      return data;
    }
  }

  async function open(catalogPath = 'static-data/catalog.json', fetcher = fetch) {
    const catalogURL = new URL(catalogPath, location.href);
    const response = await fetcher(catalogURL, {cache: 'no-store'});
    if (!response.ok) throw new Error('Published study-day catalog is unavailable.');
    const catalog = await response.json();
    if (catalog.schema !== SCHEMA || catalog.schemaVersion !== VERSION || !catalog.meta || !catalog.available || !catalog.days) throw new Error('Published study-day catalog failed its schema check.');
    return new StaticSessionStore(catalog, catalogURL, fetcher);
  }

  return Object.freeze({SCHEMA, VERSION, StaticSessionStore, open});
});
