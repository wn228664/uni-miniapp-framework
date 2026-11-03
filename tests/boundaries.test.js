import test from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, createHttp } from '../src/core/http.js'
import { createUpload } from '../src/core/upload.js'
import { createSession } from '../src/core/session.js'
import { createPagination } from '../src/core/pagination.js'
import { validateFields, dateInput, dateTimestamp } from '../src/utils/index.js'

test('API base rejects embedded credentials, query and fragment', () => {
  for (const base of [
    'https://user:pass@example.test',
    'https://example.test?x=1',
    'https://example.test/#hash',
  ]) {
    assert.throws(() => apiUrl(base, '/items'), { code: 'API_NOT_CONFIGURED' })
  }
  assert.equal(apiUrl('https://example.test/v1/', '/items'), 'https://example.test/v1/items')
})
test('request rejects a callback with no valid HTTP status', async () => {
  const request = createHttp({
    baseUrl: 'https://example.test',
    session: createSession(),
    platform: {
      request(options) {
        queueMicrotask(() => options.success({ data: 'invalid' }))
        return {}
      },
    },
  })
  await assert.rejects(request('/items').promise, { code: 'DECODE' })
})
test('upload rejects a callback with no valid HTTP status', async () => {
  const upload = createUpload({
    baseUrl: 'https://example.test',
    session: createSession(),
    platform: {
      uploadFile(options) {
        queueMicrotask(() => options.success({ data: 'https://example.test/image.png' }))
        return {}
      },
    },
  })
  await assert.rejects(upload('/upload', '/tmp/image', { decode: (value) => value }).promise, {
    code: 'DECODE',
  })
})
test('pagination rejects invalid page sizes before side effects', () => {
  for (const pageSize of [0, -1, 1.5, Infinity])
    assert.throws(() => createPagination({ load: async () => ({}), pageSize }), RangeError)
})
test('form rule contract refuses asynchronous validation results', () => {
  assert.throws(() => validateFields({ name: 'x' }, { name: [() => Promise.resolve('late')] }), /同步/)
})

test('date fields round trip in local calendar and reject impossible dates', () => {
  assert.equal(dateInput(dateTimestamp('2024-02-29')), '2024-02-29')
  assert.equal(dateTimestamp('2025-02-29'), null)
  assert.equal(dateTimestamp('2026-13-01'), null)
  assert.equal(dateTimestamp(''), null)
  assert.equal(dateInput(null), '')
})
