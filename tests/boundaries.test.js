/** 验证 API 来源、平台回调状态码、分页参数、同步验证规则与本地日历边界；均为无网络副作用的替身。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, createHttp } from '../src/core/http.js'
import { createUpload } from '../src/core/upload.js'
import { createSession } from '../src/core/session.js'
import { createPagination } from '../src/core/pagination.js'
import { validateFields, dateInput, dateTimestamp } from '../src/utils/index.js'

/**
 * 断言 API 基址不接受嵌入凭证、查询与片段，同时保留合法路径前缀。
 */
test('API base rejects embedded credentials, query and fragment', () => {
  // base：包含用户信息、查询或片段的非法 API 基址。
  for (const base of [
    'https://user:pass@example.test',
    'https://example.test?x=1',
    'https://example.test/#hash',
  ]) {
    assert.throws(
      /**
       * 构造当前非法基址以触发 API_NOT_CONFIGURED。
       */
      () => apiUrl(base, '/items'),
      { code: 'API_NOT_CONFIGURED' },
    )
  }
  assert.equal(apiUrl('https://example.test/v1/', '/items'), 'https://example.test/v1/items')
})
/**
 * 断言缺少有效 HTTP 状态码的成功回调仍然失败。
 */
test('request rejects a callback with no valid HTTP status', async () => {
  // request：绑定本地平台替身的 HTTP 服务，不发真实请求。
  const request = createHttp({
    baseUrl: 'https://example.test',
    session: createSession(),
    platform: {
      /**
       * 记录请求并在微任务中返回缺失状态码的响应。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      request(options) {
        queueMicrotask(
          /**
           * 在调用栈结束后注入缺少状态码的请求回调。
           */
          () => options.success({ data: 'invalid' }),
        )
        return {}
      },
    },
  })
  await assert.rejects(request('/items').promise, { code: 'DECODE' })
})
/**
 * 断言上传缺少有效 HTTP 状态码时不能接受结果。
 */
test('upload rejects a callback with no valid HTTP status', async () => {
  // upload：绑定本地平台替身的上传服务，不读取或上传真实文件。
  const upload = createUpload({
    baseUrl: 'https://example.test',
    session: createSession(),
    platform: {
      /**
       * 模拟缺少状态码但含 URL 文本的上传回调。
       * options：框架交给平台替身的调用参数，包含可由用例主动触发的 success/fail 回调。
       */
      uploadFile(options) {
        queueMicrotask(
          /**
           * 通过微任务注入畸形上传响应。
           */
          () => options.success({ data: 'https://example.test/image.png' }),
        )
        return {}
      },
    },
  })
  await assert.rejects(
    upload('/upload', '/tmp/image', {
      /**
       * 保持上传响应文本原样，排除解码器干扰状态码验证。
       * value：上传响应解码器收到的原始响应文本，此用例按原样返回。
       */
      decode: (value) => value,
    }).promise,
    {
      code: 'DECODE',
    },
  )
})
/**
 * 断言非法 pageSize 在加载器启动前同步拒绝。
 */
test('pagination rejects invalid page sizes before side effects', () => {
  // pageSize：非正、非整数或非有限的每页条数，必须在加载前拒绝。
  for (const pageSize of [0, -1, 1.5, Infinity])
    assert.throws(
      /**
       * 尝试以当前非法 pageSize 创建分页控制器。
       */
      () =>
        createPagination({
          /**
           * 不应执行的加载替身，非法页容量在构造时已拒绝。
           */
          load: async () => ({}),
          pageSize,
        }),
      RangeError,
    )
})
/**
 * 断言异步规则不能混入同步表单验证合同。
 */
test('form rule contract refuses asynchronous validation results', () => {
  assert.throws(
    /**
     * 运行含 Promise 规则的同步校验，预期抛错。
     */
    () =>
      validateFields(
        { name: 'x' },
        {
          name: [
            /**
             * 故意返回 Promise，验证验证器拒绝异步规则。
             */
            () => Promise.resolve('late'),
          ],
        },
      ),
    /同步/,
  )
})

/**
 * 断言闰日按本地日历往返，不存在的日期返回空值。
 */
test('date fields round trip in local calendar and reject impossible dates', () => {
  assert.equal(dateInput(dateTimestamp('2024-02-29')), '2024-02-29')
  assert.equal(dateTimestamp('2025-02-29'), null)
  assert.equal(dateTimestamp('2026-13-01'), null)
  assert.equal(dateTimestamp(''), null)
  assert.equal(dateInput(null), '')
})
