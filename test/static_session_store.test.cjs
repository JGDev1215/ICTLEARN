'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {StaticSessionStore} = require('../prototype/static_session_store.js');

function fixture() {
  const available = {'nyam:1': ['2026-09-02', '2026-09-03', '2026-09-04']};
  const payloads = Object.fromEntries(available['nyam:1'].map(day => {
    const value = {schema: 'ictlearn.static-session-day', schemaVersion: 1, date: day, sessions: {'nyam:1': {date: day, session: 'nyam', timeframe: 1, bars: [{t: day + 'T11:00:00Z'}]}}};
    return [day, Buffer.from(JSON.stringify(value))];
  }));
  const days = Object.fromEntries(available['nyam:1'].map(day => [day, {path: `days/${day}.json`, bytes: payloads[day].length, sha256: crypto.createHash('sha256').update(payloads[day]).digest('hex')} ]));
  const catalog = {meta: {minDate: '2026-09-02', maxDate: '2026-09-04'}, publicationScope: 'test', available, days};
  let requests = 0;
  const fetcher = async url => {
    requests += 1;
    const day = url.pathname.match(/(\d{4}-\d{2}-\d{2})\.json$/)[1];
    return {ok: true, arrayBuffer: async () => payloads[day].buffer.slice(payloads[day].byteOffset, payloads[day].byteOffset + payloads[day].byteLength)};
  };
  return {store: new StaticSessionStore(catalog, new URL('https://example.test/static-data/catalog.json'), fetcher), requestCount: () => requests};
}

test('static store resolves calendar direction and caches each published day', async () => {
  const {store, requestCount} = fixture();
  assert.equal((await store.getSession({day: '2026-09-04', session: 'nyam', timeframe: 1, direction: 'prev'})).date, '2026-09-03');
  assert.equal((await store.getSession({day: '2026-09-03', session: 'nyam', timeframe: 1, direction: 'next'})).date, '2026-09-04');
  assert.equal((await store.getSession({day: '2026-09-02', session: 'nyam', timeframe: 1, direction: 'latest'})).date, '2026-09-04');
  assert.equal(requestCount(), 2, 'the already-loaded latest day is reused');
  await assert.rejects(store.getSession({day: '2026-09-01', session: 'nyam', timeframe: 1}), /outside the published/);
  await assert.rejects(store.getSession({day: '2026-09-02', session: 'nyam', timeframe: 5}), /No published study days/);
});

test('static store rejects a day whose bytes do not match the catalog digest', async () => {
  const {store} = fixture();
  store.catalog.days['2026-09-02'].sha256 = '0'.repeat(64);
  await assert.rejects(store.getSession({day: '2026-09-02', session: 'nyam', timeframe: 1}), /integrity check/);
});
