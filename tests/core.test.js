import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperation, createCancellation } from '../src/core/operation.js'
import { createAction } from '../src/core/action.js'
import { createSession } from '../src/core/session.js'
import { createStorage } from '../src/core/storage.js'
import { createHttp } from '../src/core/http.js'
import { createUpload } from '../src/core/upload.js'
import { createNavigation } from '../src/core/navigation.js'
import { createPagination } from '../src/core/pagination.js'
import {
  isBlank,
  encodeQuery,
  formatDate,
  formatBytes,
  validateFields,
  required,
  debounce,
} from '../src/utils/index.js'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))

test('operation cancel settles immediately and aborts once despite late callbacks', async () => {
  let resolve,
    reject,
    aborted = 0
  const op = createOperation((a, b) => {
    resolve = a
    reject = b
    return () => {
      aborted++
      b(new Error('late'))
    }
  })
  const rejected = assert.rejects(op.promise, { code: 'CANCELLED' })
  op.cancel()
  op.cancel()
  resolve('late')
  reject(new Error('late'))
  await rejected
  assert.equal(aborted, 1)
})
test('pre-canceled token does not start platform side effect', async () => {
  const token = createCancellation()
  token.cancel()
  let started = false
  await assert.rejects(
    createOperation(
      () => {
        started = true
      },
      { token },
    ).promise,
    { code: 'CANCELLED' },
  )
  assert.equal(started, false)
})
test('timeout settles tasks whose platform callback never arrives', async () => {
  let aborted = false
  await assert.rejects(
    createOperation(
      () => () => {
        aborted = true
      },
      { timeoutMs: 8 },
    ).promise,
    { code: 'TIMEOUT' },
  )
  assert.ok(aborted)
})
test('invalid timeout and synchronous platform exceptions are explicit', async () => {
  assert.throws(() => createOperation(() => {}, { timeoutMs: 0 }), RangeError)
  await assert.rejects(
    createOperation(() => {
      throw new Error('platform')
    }).promise,
    /platform/,
  )
})
test('action refuses duplicate entry and permits retry after failure', async () => {
  const action = createAction(),
    pending = deferred()
  let sideEffects = 0
  const execute = () => {
    sideEffects++
    return pending.promise
  }
  const first = action.run(execute)
  await Promise.all(Array.from({ length: 10 }, () => assert.rejects(action.run(execute), { code: 'BUSY' })))
  assert.equal(sideEffects, 1)
  pending.reject(new Error('fixture'))
  await assert.rejects(first, /fixture/)
  assert.equal(action.state.pending, false)
  assert.equal(await action.run(() => 3), 3)
  assert.equal(action.state.error, '')
})
test('old canceled action does not unlock or overwrite a new cycle', async () => {
  const action = createAction(),
    slow = deferred(),
    next = deferred()
  const first = action.run(() => slow.promise)
  await tick()
  action.cancel()
  const ignored = assert.rejects(first, { code: 'CANCELLED' })
  const second = action.run(() => next.promise)
  slow.resolve('old')
  await tick()
  assert.equal(action.state.pending, true)
  next.resolve('new')
  assert.equal(await second, 'new')
  await ignored
})
test('disposed action rejects new work', async () => {
  const action = createAction()
  action.dispose()
  await assert.rejects(
    action.run(() => 1),
    { code: 'DISPOSED' },
  )
})
test('storage isolates namespace, handles TTL, and preserves unrelated values', () => {
  const data = new Map([['other:key', 'keep']])
  let now = 100
  const storage = createStorage(
    {
      getStorageSync: (key) => data.get(key),
      setStorageSync: (key, value) => data.set(key, value),
      removeStorageSync: (key) => data.delete(key),
    },
    'test',
    () => now,
  )
  storage.set('zero', 0)
  assert.equal(storage.get('zero'), 0)
  storage.set('ttl', 'fresh', 10)
  now = 111
  assert.equal(storage.get('ttl', 'fallback'), 'fallback')
  assert.equal(data.get('other:key'), 'keep')
  data.set('test:bad', '{bad')
  assert.equal(storage.get('bad'), null)
})
test('failed storage writes throw rather than reporting success', () => {
  const storage = createStorage({
    setStorageSync() {
      throw new Error('quota')
    },
  })
  assert.throws(() => storage.set('x', 1), { code: 'STORAGE' })
  assert.throws(() => storage.set('x', 1, 0), RangeError)
})
function httpFixture() {
  const calls = [],
    session = createSession()
  session.set({ token: 'fixture', permissions: ['view', 3] })
  const request = createHttp({
    baseUrl: 'https://api.example.test',
    session,
    platform: {
      request(options) {
        const task = {
          aborted: false,
          abort() {
            task.aborted = true
            options.fail({ errMsg: 'abort' })
          },
        }
        calls.push({ options, task })
        return task
      },
    },
  })
  return { calls, session, request }
}
test('HTTP returns raw payload and adds the current credential', async () => {
  const { calls, request, session } = httpFixture()
  const task = request('/items')
  assert.equal(calls[0].options.header.Authorization, 'Bearer fixture')
  assert.deepEqual(session.state.permissions, ['view'])
  calls[0].options.success({ statusCode: 200, data: { custom: true } })
  assert.deepEqual(await task.promise, { custom: true })
})
test('HTTP rejects absolute and protocol-relative paths before transport', () => {
  const { request, calls } = httpFixture()
  for (const path of ['//evil.test', 'https://evil.test', '/bad\\path', '/bad path'])
    assert.throws(() => request(path), { code: 'INVALID_PATH' })
  assert.equal(calls.length, 0)
})
test('unconfigured API leaves startup independent but rejects requests', () => {
  const session = createSession()
  const request = createHttp({ platform: {}, session })
  assert.throws(() => request('/items'), { code: 'API_NOT_CONFIGURED' })
})
test('old successful response and old 401 cannot pollute new session', async () => {
  const { request, calls, session } = httpFixture()
  const a = request('/first'),
    b = request('/second')
  session.set({ token: 'new' })
  calls[0].options.success({ statusCode: 200, data: 'old' })
  calls[1].options.success({ statusCode: 401 })
  await assert.rejects(a.promise, { code: 'STALE' })
  await assert.rejects(b.promise, { code: 'STALE' })
  assert.equal(session.state.token, 'new')
})
test('current 401 clears session, public 401 does not', async () => {
  const { request, calls, session } = httpFixture()
  const a = request('/public', { authenticated: false })
  assert.equal(calls[0].options.header.Authorization, undefined)
  calls[0].options.success({ statusCode: 401 })
  await assert.rejects(a.promise, { code: 'HTTP' })
  assert.equal(session.state.token, 'fixture')
  const b = request('/private')
  calls[1].options.success({ statusCode: 401 })
  await assert.rejects(b.promise, { code: 'HTTP' })
  assert.equal(session.state.token, '')
})
test('request cancellation aborts underlying task and retains cancel error', async () => {
  const { request, calls } = httpFixture()
  const a = request('/items')
  a.cancel()
  await assert.rejects(a.promise, { code: 'CANCELLED' })
  assert.ok(calls[0].task.aborted)
})
test('upload decodes explicitly and detaches progress on completion', async () => {
  let options,
    handler,
    detached = 0
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session: createSession(),
    platform: {
      uploadFile(value) {
        options = value
        return {
          onProgressUpdate(fn) {
            handler = fn
          },
          offProgressUpdate() {
            detached++
          },
          abort() {},
        }
      },
    },
  })
  const progress = []
  const op = upload('/upload', '/tmp/image.png', { decode: JSON.parse, onProgress: (n) => progress.push(n) })
  handler({ progress: 200 })
  options.success({ statusCode: 200, data: '"https://cdn.example.test/image.png"' })
  assert.equal(await op.promise, 'https://cdn.example.test/image.png')
  assert.deepEqual(progress, [100])
  assert.equal(detached, 1)
})
test('upload cannot silently accept malformed business output', async () => {
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session: createSession(),
    platform: {
      uploadFile(options) {
        queueMicrotask(() => options.success({ statusCode: 200, data: '{}' }))
        return {}
      },
    },
  })
  await assert.rejects(upload('/upload', '/tmp/image', { decode: JSON.parse }).promise, { code: 'DECODE' })
})
test('upload failure from an old session is stale and leaves new login intact', async () => {
  const session = createSession()
  session.set({ token: 'old' })
  let callbacks
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session,
    platform: {
      uploadFile: (options) => {
        callbacks = options
        return {}
      },
    },
  })
  const op = upload('/upload', '/tmp/image', { decode: JSON.parse })
  session.set({ token: 'new' })
  callbacks.fail({ errMsg: 'late network error' })
  await assert.rejects(op.promise, { code: 'STALE' })
  assert.equal(session.state.token, 'new')
})
test('navigation blocks duplicate, checks permission, and restores after failure', async () => {
  const callbacks = []
  const nav = createNavigation({
    platform: { navigateTo: (options) => callbacks.push(options) },
    routes: [{ path: '/page' }, { path: '/secure', requiresAuth: true }],
    session: createSession(),
  })
  await assert.rejects(nav.go('/secure'), { code: 'AUTH_REQUIRED' })
  const first = nav.go('/page', { query: { text: 'a b' } })
  await assert.rejects(nav.go('/page'), { code: 'BUSY' })
  assert.equal(callbacks[0].url, '/page?text=a%20b')
  callbacks[0].fail({})
  await assert.rejects(first, { code: 'NAVIGATION' })
  const second = nav.go('/page')
  callbacks[1].success({})
  await second
})
test('navigation has a safe direct-entry back fallback and tab query guard', async () => {
  let target
  const nav = createNavigation({
    platform: {
      redirectTo(options) {
        target = options.url
        options.success({})
      },
    },
    routes: [{ path: '/home' }, { path: '/tab', tab: true }],
    session: createSession(),
  })
  await nav.back('/home')
  assert.equal(target, '/home')
  await assert.rejects(nav.go('/tab', { query: { x: 1 } }), { code: 'INVALID_QUERY' })
  await assert.rejects(nav.go('https://evil.test'), { code: 'INVALID_ROUTE' })
})
test('pagination advances only after success, deduplicates, and retries failed page', async () => {
  let fail = true
  const pages = []
  const pager = createPagination({
    load: async ({ page }) => {
      pages.push(page)
      if (page === 2 && fail) throw new Error('fixture')
      return { items: [{ id: 1 }, { id: page + 1 }], hasMore: page < 2 }
    },
  })
  await pager.next()
  await assert.rejects(pager.next(), /fixture/)
  assert.equal(pager.state.page, 1)
  fail = false
  await pager.next()
  assert.deepEqual(pages, [1, 2, 2])
  assert.deepEqual(
    pager.state.items.map((x) => x.id),
    [1, 2, 3],
  )
  assert.equal(pager.state.hasMore, false)
})
test('refresh invalidates old page and dispose prevents late state writes', async () => {
  const calls = []
  const pager = createPagination({
    load() {
      const d = deferred()
      calls.push(d)
      return d.promise
    },
  })
  const first = pager.next()
  await tick()
  const oldRejected = assert.rejects(first, { code: 'CANCELLED' })
  const next = pager.refresh()
  await tick()
  calls[0].resolve({ items: [{ id: 'old' }], hasMore: false })
  calls[1].resolve({ items: [{ id: 'new' }], hasMore: true })
  await next
  await oldRejected
  assert.equal(pager.state.items[0].id, 'new')
  const third = pager.next()
  await tick()
  pager.dispose()
  calls[2].resolve({ items: [{ id: 'late' }], hasMore: false })
  await assert.rejects(third, { code: 'CANCELLED' })
  assert.equal(pager.state.items.length, 1)
})
test('invalid pagination response is explicit and does not advance', async () => {
  const pager = createPagination({ load: async () => ({ items: [{}], hasMore: false }) })
  await assert.rejects(pager.next(), { code: 'DECODE' })
  assert.equal(pager.state.page, 0)
})
test('utilities preserve valid zero/false and encode query without injection', () => {
  assert.equal(isBlank(0), false)
  assert.equal(isBlank(false), false)
  assert.equal(formatDate(null), '')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(encodeQuery({ a: '& b', n: 0, skip: null }), 'a=%26%20b&n=0')
  assert.throws(() => encodeQuery({ x: {} }), TypeError)
  assert.deepEqual(validateFields({ title: ' ' }, { title: [required('必填')] }), { title: '必填' })
})
test('debounce cancellation suppresses pending callback', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 5)
  fn()
  fn()
  fn.cancel()
  await new Promise((resolve) => setTimeout(resolve, 12))
  assert.equal(calls, 0)
})

test('global loading keeps remaining owner visible when another task ends', async () => {
  const { createFeedback } = await import('../src/core/feedback.js')
  const events = [],
    a = deferred(),
    b = deferred()
  const feedback = createFeedback({
    showLoading: (x) => events.push(x.title),
    hideLoading: () => events.push('hidden'),
  })
  const first = feedback.withLoading('A', () => a.promise),
    second = feedback.withLoading('B', () => b.promise)
  a.resolve()
  await first
  assert.notEqual(events.at(-1), 'hidden')
  b.reject(new Error('fixture'))
  await assert.rejects(second, /fixture/)
  assert.equal(events.at(-1), 'hidden')
})
test('media cancellation settles selection and ignores late chooser results', async () => {
  const { createMedia } = await import('../src/core/media.js')
  let options
  const media = createMedia({
    chooseImage: (value) => {
      options = value
    },
  })
  const op = media.chooseImage()
  op.cancel()
  options.success({ tempFiles: [] })
  await assert.rejects(op.promise, { code: 'CANCELLED' })
  assert.throws(() => media.compressImage('/tmp/image', { quality: 101 }), RangeError)
  await assert.rejects(media.compressImage('/tmp/image').promise, { code: 'UNSUPPORTED' })
})
