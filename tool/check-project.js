/** 只读检查技术栈、业务残留、路由文件和平台默认配置；任何不匹配通过非零退出阻止交付，不修改源码。 */
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
// root：根据当前脚本 URL 定位的工程根目录，不依赖调用者工作目录。
const root = fileURLToPath(new URL('../', import.meta.url))
/**
 * 递归返回目录内文件路径；读取失败直接抛出，不把缺失文件视为检查通过。
 * dir：本次递归扫描的绝对目录。
 */
async function files(dir) {
  // entries：当前目录的带类型条目，用于区分文件和子目录。
  const entries = await readdir(dir, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map(
        /**
         * 递归子目录或保留普通文件的绝对路径。
         * entry：当前目录条目，子目录递归展开为文件路径。
         */
        (entry) => (entry.isDirectory() ? files(resolve(dir, entry.name)) : resolve(dir, entry.name)),
      ),
    )
  ).flat()
}
// source：src 下全部文件清单，包含源码、配置及资源。
const source = await files(resolve(root, 'src'))
// file：正在检查的源文件绝对路径。
for (const file of source) {
  if (/\.tsx?$/.test(file)) throw new Error(`源码含 TS: ${file}`)
  if (!/\.(js|vue|json|scss|css|html)$/.test(file)) continue
  // content：可读源码或配置文本，用于检测技术栈和业务残留。
  const content = await readFile(file, 'utf8')
  if (/<uni-[a-z]/.test(content)) throw new Error(`旧 UI 组件残留: ${file}`)
  if (/lang=["']ts["']/.test(content)) throw new Error(`组件含 TS: ${file}`)
  if (/jg-admin|jg-h5|reader_flutter|talestime|epccGwMsg|bankBind|PRIVATE KEY-----/.test(content))
    throw new Error(`业务或凭证残留: ${file}`)
}
// manifestPackage：package.json 内容，检查 UI 依赖是否采用 uview-plus。
const manifestPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (manifestPackage.dependencies['@dcloudio/uni-ui'] || !manifestPackage.dependencies['uview-plus'])
  throw new Error('UI 依赖未完成迁移')
// pages：pages.json 路由配置，逐一验证对应 Vue 页面存在。
const pages = JSON.parse(await readFile(resolve(root, 'src/pages.json'), 'utf8'))
// page：当前待检查的路由项，path 不包含 .vue 扩展名。
for (const page of pages.pages) await readFile(resolve(root, `src/${page.path}.vue`))
// group：当前分包定义，root 与子页面 path 共同形成文件路径。
// page：当前待检查的路由项，path 不包含 .vue 扩展名。
for (const group of pages.subPackages)
  for (const page of group.pages) await readFile(resolve(root, `src/${group.root}/${page.path}.vue`))
// manifest：平台 manifest，要求统计默认关闭且微信域名校验开启。
const manifest = JSON.parse(await readFile(resolve(root, 'src/manifest.json'), 'utf8'))
if (manifest.uniStatistics.enable || manifest['mp-weixin'].setting.urlCheck !== true)
  throw new Error('默认统计或域名检查配置错误')
console.log(
  `Project check passed: ${source.length} source/config/asset files; routes valid; statistics disabled.`,
)
