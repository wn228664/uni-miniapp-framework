/** 核心服务契约测试。请求、上传、导航、存储和时钟均由本地替身控制，断言取消、身份隔离、重试与资源清理。 */
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
// deferred：创建可由测试主动完成或拒绝的异步任务，避免依赖真实网络时序。
const deferred =
  /**
   * 创建手动结算的异步 fixture，每次调用都有独立 Promise 和完成入口。
   */
  () => {
    // resolve：受控 Promise 的成功完成入口，由用例决定结算时机。
    // reject：受控 Promise 的失败入口，由用例注入预期错误。
    let resolve, reject
    // promise：由外部 resolve/reject 控制结算的 Promise。
    const promise = new Promise(
      /**
       * 保存 Promise 的完成和失败入口，交给测试控制。
       * a：新 Promise 的成功入口，暴露为 deferred.resolve。
       * b：新 Promise 的失败入口，暴露为 deferred.reject。
       */
      (a, b) => {
        resolve = a
        reject = b
      },
    )
    return { promise, resolve, reject }
  }
// tick：等待一个事件循环以让控制器进入可观测的下一阶段。
const tick =
  /**
   * 等待一个事件循环，便于观察控制器取消与新周期状态。
   */
  () =>
    new Promise(
      /**
       * 在 setImmediate 回调中完成 tick。
       * resolve：受控 Promise 的成功完成入口，由用例决定结算时机。
       */
      (resolve) => setImmediate(resolve),
    )

/**
 * 断言取消立即结算、底层只 abort 一次，迟到回调不能改变 CANCELLED。
 */
test('operation cancel settles immediately and aborts once despite late callbacks', async () => {
  // resolve：受控 Promise 的成功完成入口，由用例决定结算时机。
  // reject：受控 Promise 的失败入口，由用例注入预期错误。
  // aborted：底层取消是否执行或执行次数，按本用例断言只清理一次。
  let resolve,
    reject,
    aborted = 0
  // op：本次可取消操作，promise 交付结果，cancel 结束本周期等待。
  const op = createOperation(
    /**
     * 保存操作回调并返回底层取消函数。
     * a：操作成功入口，取消后注入迟到成功验证只结算一次。
     * b：操作失败入口，底层 abort 和迟到失败均不能覆盖取消。
     */
    (a, b) => {
      resolve = a
      reject = b
      return (
        /**
         * 记录取消并注入迟到失败，验证取消错误优先。
         */
        () => {
          aborted++
          b(new Error('late'))
        }
      )
    },
  )
  // rejected：在取消前登记的拒绝断言，避免未处理拒绝。
  const rejected = assert.rejects(op.promise, { code: 'CANCELLED' })
  op.cancel()
  op.cancel()
  resolve('late')
  reject(new Error('late'))
  await rejected
  assert.equal(aborted, 1)
})
/**
 * 断言预先取消的令牌阻止平台副作用开始。
 */
test('pre-canceled token does not start platform side effect', async () => {
  // token：已在启动前取消的任务令牌。
  const token = createCancellation()
  token.cancel()
  // started：平台副作用是否开始，预先取消时必须保持 false。
  let started = false
  await assert.rejects(
    createOperation(
      /**
       * 标记平台副作用已启动，预先取消时不应执行。
       */
      () => {
        started = true
      },
      { token },
    ).promise,
    { code: 'CANCELLED' },
  )
  assert.equal(started, false)
})
/**
 * 断言平台永不回调时超时仍结束等待并取消底层。
 */
test('timeout settles tasks whose platform callback never arrives', async () => {
  // aborted：底层取消是否执行或执行次数，按本用例断言只清理一次。
  let aborted = false
  await assert.rejects(
    createOperation(
      /**
       * 提供带可观测取消函数的挂起操作。
       */
      () =>
        /**
         * 记录超时后底层取消。
         */
        () => {
          aborted = true
        },
      { timeoutMs: 8 },
    ).promise,
    { code: 'TIMEOUT' },
  )
  assert.ok(aborted)
})
/**
 * 断言非法超时同步报错，平台同步异常转为操作拒绝。
 */
test('invalid timeout and synchronous platform exceptions are explicit', async () => {
  assert.throws(
    /**
     * 以零超时创建操作，预期同步抛 RangeError。
     */
    () =>
      createOperation(
        /**
         * 非法超时时不应启动的空执行器。
         */
        () => {},
        { timeoutMs: 0 },
      ),
    RangeError,
  )
  await assert.rejects(
    createOperation(
      /**
       * 模拟平台在调用栈内抛出异常。
       */
      () => {
        throw new Error('platform')
      },
    ).promise,
    /platform/,
  )
})
/**
 * 断言动作拒绝重复入口，失败后释放锁并允许再次成功执行。
 */
test('action refuses duplicate entry and permits retry after failure', async () => {
  // action：当前用例独占的动作控制器，用于验证互斥、取消和销毁。
  // pending：动作执行的受控等待任务，用于保持 pending 并模拟失败。
  const action = createAction(),
    pending = deferred()
  // sideEffects：实际进入动作回调的次数，重复点击不得递增。
  let sideEffects = 0
  // execute：记录副作用并返回受控 Promise 的动作函数。
  const execute =
    /**
     * 记录实际副作用并等待测试主动结算。
     */
    () => {
      sideEffects++
      return pending.promise
    }
  // first：先启动的操作结果，用于断言失败或取消。
  const first = action.run(execute)
  await Promise.all(
    Array.from(
      { length: 10 },
      /**
       * 并发尝试重复动作，每次都应以 BUSY 拒绝。
       */
      () => assert.rejects(action.run(execute), { code: 'BUSY' }),
    ),
  )
  assert.equal(sideEffects, 1)
  pending.reject(new Error('fixture'))
  await assert.rejects(first, /fixture/)
  assert.equal(action.state.pending, false)
  assert.equal(
    await action.run(
      /**
       * 返回重试成功结果，验证旧错误已清空。
       */
      () => 3,
    ),
    3,
  )
  assert.equal(action.state.error, '')
})
/**
 * 断言旧周期取消和迟到完成不会释放新周期的锁。
 */
test('old canceled action does not unlock or overwrite a new cycle', async () => {
  // action：当前用例独占的动作控制器，用于验证互斥、取消和销毁。
  // slow：被取消的旧周期任务，完成后不得影响新周期。
  // next：下一周期的受控等待任务。
  const action = createAction(),
    slow = deferred(),
    next = deferred()
  // first：先启动的操作结果，用于断言失败或取消。
  const first = action.run(
    /**
     * 返回旧周期的延迟任务。
     */
    () => slow.promise,
  )
  await tick()
  action.cancel()
  // ignored：已经登记的旧周期取消断言，等待新周期完成后统一核对。
  const ignored = assert.rejects(first, { code: 'CANCELLED' })
  // second：随后启动的操作结果，用于断言成功与互不干扰。
  const second = action.run(
    /**
     * 返回新周期的延迟任务。
     */
    () => next.promise,
  )
  slow.resolve('old')
  await tick()
  assert.equal(action.state.pending, true)
  next.resolve('new')
  assert.equal(await second, 'new')
  await ignored
})
/**
 * 断言销毁后的控制器拒绝任何新动作。
 */
test('disposed action rejects new work', async () => {
  // action：当前用例独占的动作控制器，用于验证互斥、取消和销毁。
  const action = createAction()
  action.dispose()
  await assert.rejects(
    action.run(
      /**
       * 销毁后不应执行的成功替身。
       */
      () => 1,
    ),
    { code: 'DISPOSED' },
  )
})
/**
 * 断言存储命名空间隔离、零值保留、TTL 失效和坏数据回退。
 */
test('storage isolates namespace, handles TTL, and preserves unrelated values', () => {
  // data：内存存储替身，预置不同命名空间的键验证隔离。
  const data = new Map([['other:key', 'keep']])
  // now：可由用例推进的毫秒时钟，验证 TTL 过期无需真实等待。
  let now = 100
  // storage：注入内存或失败平台替身的命名空间存储服务。
  const storage = createStorage(
    {
      /**
       * 从内存替身读取指定键。
       * key：带命名空间前缀的存储键。
       */
      getStorageSync: (key) => data.get(key),
      /**
       * 把序列化内容写入内存替身。
       * key：带命名空间前缀的存储键。
       * value：写入内存存储的序列化内容。
       */
      setStorageSync: (key, value) => data.set(key, value),
      /**
       * 只删除指定键，不清除其他命名空间。
       * key：带命名空间前缀的存储键。
       */
      removeStorageSync: (key) => data.delete(key),
    },
    'test',
    /**
     * 提供测试控制的当前时间。
     */
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
/**
 * 断言持久化失败明确抛错而非报告保存成功。
 */
test('failed storage writes throw rather than reporting success', () => {
  // storage：注入内存或失败平台替身的命名空间存储服务。
  const storage = createStorage({
    /**
     * 模拟存储容量不足。
     */
    setStorageSync() {
      throw new Error('quota')
    },
  })
  assert.throws(
    /**
     * 执行需要抛 STORAGE 的存储写入。
     */
    () => storage.set('x', 1),
    { code: 'STORAGE' },
  )
  assert.throws(
    /**
     * 执行非法 TTL 写入，预期同步拒绝。
     */
    () => storage.set('x', 1, 0),
    RangeError,
  )
})
/**
 * 创建可观察请求队列和内存会话的 HTTP fixture。
 */
function httpFixture() {
  // calls：按启动顺序记录的平台请求与任务引用。
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const calls = [],
    session = createSession()
  session.set({ token: 'fixture', permissions: ['view', 3] })
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  const request = createHttp({
    baseUrl: 'https://api.example.test',
    session,
    platform: {
      /**
       * 保存 HTTP 参数及可取消任务，不发真实请求。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      request(options) {
        // task：本次平台请求任务，用于观测取消是否到达底层。
        const task = {
          aborted: false,
          /**
           * 标记底层请求取消并模拟平台 fail 回调。
           */
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
/**
 * 断言 HTTP 保留原始 payload，并自动注入当前认证头。
 */
test('HTTP returns raw payload and adds the current credential', async () => {
  // calls：按启动顺序记录的平台请求与任务引用。
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const { calls, request, session } = httpFixture()
  // task：本次平台请求任务，用于观测取消是否到达底层。
  const task = request('/items')
  assert.equal(calls[0].options.header.Authorization, 'Bearer fixture')
  assert.deepEqual(session.state.permissions, ['view'])
  calls[0].options.success({ statusCode: 200, data: { custom: true } })
  assert.deepEqual(await task.promise, { custom: true })
})
/**
 * 断言危险路径不会触发平台传输。
 */
test('HTTP rejects absolute and protocol-relative paths before transport', () => {
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  // calls：按启动顺序记录的平台请求与任务引用。
  const { request, calls } = httpFixture()
  // path：应在进入平台前被拒绝的危险请求路径。
  for (const path of ['//evil.test', 'https://evil.test', '/bad\\path', '/bad path'])
    assert.throws(
      /**
       * 尝试当前危险请求路径，预期同步拒绝。
       */
      () => request(path),
      { code: 'INVALID_PATH' },
    )
  assert.equal(calls.length, 0)
})
/**
 * 断言未配置 API 不阻止服务创建，但请求必须显式失败。
 */
test('unconfigured API leaves startup independent but rejects requests', () => {
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const session = createSession()
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  const request = createHttp({ platform: {}, session })
  assert.throws(
    /**
     * 尝试缺少 API 来源的请求。
     */
    () => request('/items'),
    { code: 'API_NOT_CONFIGURED' },
  )
})
/**
 * 断言旧会话的成功与 401 均隔离，新身份保持不变。
 */
test('old successful response and old 401 cannot pollute new session', async () => {
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  // calls：按启动顺序记录的平台请求与任务引用。
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const { request, calls, session } = httpFixture()
  // a：旧会话发出的第一个请求，成功也必须因身份更替失效。
  // b：旧会话发出的第二个请求，401 不能清除新身份。
  const a = request('/first'),
    b = request('/second')
  session.set({ token: 'new' })
  calls[0].options.success({ statusCode: 200, data: 'old' })
  calls[1].options.success({ statusCode: 401 })
  await assert.rejects(a.promise, { code: 'STALE' })
  await assert.rejects(b.promise, { code: 'STALE' })
  assert.equal(session.state.token, 'new')
})
/**
 * 断言公开 401 保留会话，当前认证 401 清除会话。
 */
test('current 401 clears session, public 401 does not', async () => {
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  // calls：按启动顺序记录的平台请求与任务引用。
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const { request, calls, session } = httpFixture()
  // a：显式公开请求，不附凭证且 401 不清除会话。
  const a = request('/public', { authenticated: false })
  assert.equal(calls[0].options.header.Authorization, undefined)
  calls[0].options.success({ statusCode: 401 })
  await assert.rejects(a.promise, { code: 'HTTP' })
  assert.equal(session.state.token, 'fixture')
  // b：当前身份认证请求，401 应清除当前会话。
  const b = request('/private')
  calls[1].options.success({ statusCode: 401 })
  await assert.rejects(b.promise, { code: 'HTTP' })
  assert.equal(session.state.token, '')
})
/**
 * 断言请求取消到达底层且仍以 CANCELLED 拒绝。
 */
test('request cancellation aborts underlying task and retains cancel error', async () => {
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  // calls：按启动顺序记录的平台请求与任务引用。
  const { request, calls } = httpFixture()
  // a：待取消的请求操作，cancel 必须调用底层 abort。
  const a = request('/items')
  a.cancel()
  await assert.rejects(a.promise, { code: 'CANCELLED' })
  assert.ok(calls[0].task.aborted)
})
/**
 * 断言上传显式解码、进度钳制且成功后移除监听。
 */
test('upload decodes explicitly and detaches progress on completion', async () => {
  // options：平台保存的上传参数，随后手动触发成功响应。
  // handler：平台保存的上传进度回调，供用例注入越界进度。
  // detached：上传进度监听移除次数，完成后应为一次。
  let options,
    handler,
    detached = 0
  // upload：绑定本地平台替身的上传服务，不读取或上传真实文件。
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session: createSession(),
    platform: {
      /**
       * 保存上传参数并提供最小进度/取消平台任务。
       * value：uploadFile 收到的上传参数，保存为 options。
       */
      uploadFile(value) {
        options = value
        return {
          /**
           * 保存本次上传的进度监听器。
           * fn：上传进度监听器，保存后由用例手动触发。
           */
          onProgressUpdate(fn) {
            handler = fn
          },
          /**
           * 记录上传进度监听移除。
           */
          offProgressUpdate() {
            detached++
          },
          /**
           * 成功路径中的底层取消空实现，本用例不触发取消。
           */
          abort() {},
        }
      },
    },
  })
  // progress：调用者实际收到的上传百分比序列。
  const progress = []
  // op：本次可取消操作，promise 交付结果，cancel 结束本周期等待。
  const op = upload('/upload', '/tmp/image.png', {
    decode: JSON.parse,

    /**
     * 记录调用者收到的规范化进度。
     * n：框架规范到 0..100 的上传百分比。
     */
    onProgress: (n) => progress.push(n),
  })
  handler({ progress: 200 })
  options.success({ statusCode: 200, data: '"https://cdn.example.test/image.png"' })
  assert.equal(await op.promise, 'https://cdn.example.test/image.png')
  assert.deepEqual(progress, [100])
  assert.equal(detached, 1)
})
/**
 * 断言错误业务输出不能被上传层静默接受。
 */
test('upload cannot silently accept malformed business output', async () => {
  // upload：绑定本地平台替身的上传服务，不读取或上传真实文件。
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session: createSession(),
    platform: {
      /**
       * 安排返回不符合 URL 合同的上传输出。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      uploadFile(options) {
        queueMicrotask(
          /**
           * 在微任务中注入上传成功但业务输出畸形的响应。
           */
          () => options.success({ statusCode: 200, data: '{}' }),
        )
        return {}
      },
    },
  })
  await assert.rejects(upload('/upload', '/tmp/image', { decode: JSON.parse }).promise, { code: 'DECODE' })
})
/**
 * 断言旧身份上传失败不能清理新登录态。
 */
test('upload failure from an old session is stale and leaves new login intact', async () => {
  // session：当前用例独占的内存会话，不读取真实用户凭证。
  const session = createSession()
  session.set({ token: 'old' })
  // callbacks：平台保存的调用参数和完成回调，由用例控制结果。
  let callbacks
  // upload：绑定本地平台替身的上传服务，不读取或上传真实文件。
  const upload = createUpload({
    baseUrl: 'https://api.example.test',
    session,
    platform: {
      /**
       * 保存旧上传回调以便身份切换后注入迟到失败。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      uploadFile: (options) => {
        callbacks = options
        return {}
      },
    },
  })
  // op：本次可取消操作，promise 交付结果，cancel 结束本周期等待。
  const op = upload('/upload', '/tmp/image', { decode: JSON.parse })
  session.set({ token: 'new' })
  callbacks.fail({ errMsg: 'late network error' })
  await assert.rejects(op.promise, { code: 'STALE' })
  assert.equal(session.state.token, 'new')
})
/**
 * 断言导航互斥、鉴权、查询编码与失败后的重试。
 */
test('navigation blocks duplicate, checks permission, and restores after failure', async () => {
  // callbacks：平台保存的调用参数和完成回调，由用例控制结果。
  const callbacks = []
  // nav：注入本地路由表和平台替身的导航服务。
  const nav = createNavigation({
    platform: {
      /**
       * 保存导航调用，供测试主动失败或完成。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      navigateTo: (options) => callbacks.push(options),
    },
    routes: [{ path: '/page' }, { path: '/secure', requiresAuth: true }],
    session: createSession(),
  })
  await assert.rejects(nav.go('/secure'), { code: 'AUTH_REQUIRED' })
  // first：先启动的操作结果，用于断言失败或取消。
  const first = nav.go('/page', { query: { text: 'a b' } })
  await assert.rejects(nav.go('/page'), { code: 'BUSY' })
  assert.equal(callbacks[0].url, '/page?text=a%20b')
  callbacks[0].fail({})
  await assert.rejects(first, { code: 'NAVIGATION' })
  // second：随后启动的操作结果，用于断言成功与互不干扰。
  const second = nav.go('/page')
  callbacks[1].success({})
  await second
})
/**
 * 断言直接进入页面时安全返回首页，并拒绝 tab 查询与外部地址。
 */
test('navigation has a safe direct-entry back fallback and tab query guard', async () => {
  // target：直接进入页面时安全返回所选择的目标路径。
  let target
  // nav：注入本地路由表和平台替身的导航服务。
  const nav = createNavigation({
    platform: {
      /**
       * 记录替换路由并同步模拟成功。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
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
/**
 * 断言分页仅成功后推进，去重并重新请求失败页。
 */
test('pagination advances only after success, deduplicates, and retries failed page', async () => {
  // fail：是否让第二页加载失败，用于切换失败和重试成功。
  let fail = true
  // pages：分页加载器实际收到的页码顺序，验证失败不跳页。
  const pages = []
  // pager：当前用例独占的分页控制器，页码只在成功后推进。
  const pager = createPagination({
    /**
     * 记录目标页码，按测试开关模拟第二页失败或成功。
     * page：加载器收到的目标页码，失败时下次仍请求同一页。
     */
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
    pager.state.items.map(
      /**
       * 提取行 id 断言跨页去重。
       * x：分页返回的单行数据，此处只提取 id 比较去重结果。
       */
      (x) => x.id,
    ),
    [1, 2, 3],
  )
  assert.equal(pager.state.hasMore, false)
})
/**
 * 断言刷新隔离旧请求，销毁后不写回迟到数据。
 */
test('refresh invalidates old page and dispose prevents late state writes', async () => {
  // calls：按次序保存分页加载的受控等待任务。
  const calls = []
  // pager：当前用例独占的分页控制器，页码只在成功后推进。
  const pager = createPagination({
    /**
     * 每次分页加载返回独立可控任务。
     */
    load() {
      // d：本次分页加载独占的受控 Promise。
      const d = deferred()
      calls.push(d)
      return d.promise
    },
  })
  // first：先启动的操作结果，用于断言失败或取消。
  const first = pager.next()
  await tick()
  // oldRejected：刷新前旧分页任务的取消断言。
  const oldRejected = assert.rejects(first, { code: 'CANCELLED' })
  // next：下一周期的受控等待任务。
  const next = pager.refresh()
  await tick()
  calls[0].resolve({ items: [{ id: 'old' }], hasMore: false })
  calls[1].resolve({ items: [{ id: 'new' }], hasMore: true })
  await next
  await oldRejected
  assert.equal(pager.state.items[0].id, 'new')
  // third：刷新成功后启动、随后在 dispose 中取消的分页任务。
  const third = pager.next()
  await tick()
  pager.dispose()
  calls[2].resolve({ items: [{ id: 'late' }], hasMore: false })
  await assert.rejects(third, { code: 'CANCELLED' })
  assert.equal(pager.state.items.length, 1)
})
/**
 * 断言缺少有效行 key 的分页输出拒绝且不推进页码。
 */
test('invalid pagination response is explicit and does not advance', async () => {
  // pager：当前用例独占的分页控制器，页码只在成功后推进。
  const pager = createPagination({
    /**
     * 返回缺少稳定 key 的行，触发 DECODE。
     */
    load: async () => ({ items: [{}], hasMore: false }),
  })
  await assert.rejects(pager.next(), { code: 'DECODE' })
  assert.equal(pager.state.page, 0)
})
/**
 * 断言工具保留零和 false，查询编码无注入，校验保留首个错误。
 */
test('utilities preserve valid zero/false and encode query without injection', () => {
  assert.equal(isBlank(0), false)
  assert.equal(isBlank(false), false)
  assert.equal(formatDate(null), '')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(encodeQuery({ a: '& b', n: 0, skip: null }), 'a=%26%20b&n=0')
  assert.throws(
    /**
     * 尝试编码对象参数，预期拒绝而非隐式转字符串。
     */
    () => encodeQuery({ x: {} }),
    TypeError,
  )
  assert.deepEqual(validateFields({ title: ' ' }, { title: [required('必填')] }), { title: '必填' })
})
/**
 * 断言防抖取消后不再执行已排队业务回调。
 */
test('debounce cancellation suppresses pending callback', async () => {
  // calls：防抖业务回调实际执行次数，取消后必须为零。
  let calls = 0
  // fn：带 cancel 的防抖包装函数。
  const fn = debounce(
    /**
     * 记录防抖业务真正执行的次数。
     */
    () => calls++,
    5,
  )
  fn()
  fn()
  fn.cancel()
  await new Promise(
    /**
     * 等待超过防抖间隔后检查业务仍未执行。
     * resolve：受控 Promise 的成功完成入口，由用例决定结算时机。
     */
    (resolve) => setTimeout(resolve, 12),
  )
  assert.equal(calls, 0)
})

/**
 * 断言全局 loading 在其他调用者仍等待时不能被提前隐藏。
 */
test('global loading keeps remaining owner visible when another task ends', async () => {
  // createFeedback：动态加载的反馈服务工厂，仅在全局 loading 用例中使用。
  const { createFeedback } = await import('../src/core/feedback.js')
  // events：平台 loading 显示标题与隐藏事件的顺序。
  // a：loading 调用者 A 的受控任务。
  // b：loading 调用者 B 的受控任务。
  const events = [],
    a = deferred(),
    b = deferred()
  // feedback：拥有多个 loading 调用者的共享反馈服务。
  const feedback = createFeedback({
    /**
     * 记录平台 loading 标题。
     * x：平台 showLoading 的参数，此处只记录 title。
     */
    showLoading: (x) => events.push(x.title),
    /**
     * 记录平台 loading 被隐藏的事件。
     */
    hideLoading: () => events.push('hidden'),
  })
  // first：先启动的操作结果，用于断言失败或取消。
  // second：随后启动的操作结果，用于断言成功与互不干扰。
  const first = feedback.withLoading(
      'A',
      /**
       * 返回调用者 A 的受控等待。
       */
      () => a.promise,
    ),
    second = feedback.withLoading(
      'B',
      /**
       * 返回调用者 B 的受控等待。
       */
      () => b.promise,
    )
  a.resolve()
  await first
  assert.notEqual(events.at(-1), 'hidden')
  b.reject(new Error('fixture'))
  await assert.rejects(second, /fixture/)
  assert.equal(events.at(-1), 'hidden')
})
/**
 * 断言媒体取消忽略迟到结果，非法压缩参数和未支持平台显式失败。
 */
test('media cancellation settles selection and ignores late chooser results', async () => {
  // createMedia：动态加载的媒体服务工厂，提供选择与压缩操作。
  const { createMedia } = await import('../src/core/media.js')
  // options：媒体选择器收到的参数，供取消后模拟迟到 success。
  let options
  // media：绑定本地选择器替身的媒体服务。
  const media = createMedia({
    /**
     * 保存平台选择参数以模拟迟到选择结果。
     * value：平台 chooseImage 调用参数，包含选择完成回调。
     */
    chooseImage: (value) => {
      options = value
    },
  })
  // op：本次可取消操作，promise 交付结果，cancel 结束本周期等待。
  const op = media.chooseImage()
  op.cancel()
  options.success({ tempFiles: [] })
  await assert.rejects(op.promise, { code: 'CANCELLED' })
  assert.throws(
    /**
     * 以越界压缩质量执行操作，预期同步抛 RangeError。
     */
    () => media.compressImage('/tmp/image', { quality: 101 }),
    RangeError,
  )
  await assert.rejects(media.compressImage('/tmp/image').promise, { code: 'UNSUPPORTED' })
})
