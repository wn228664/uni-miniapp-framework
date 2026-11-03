import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? files(resolve(dir, entry.name)) : resolve(dir, entry.name),
      ),
    )
  ).flat()
}
const source = await files(resolve(root, 'src'))
for (const file of source) {
  if (/\.tsx?$/.test(file)) throw new Error(`源码含 TS: ${file}`)
  if (!/\.(js|vue|json|scss|css|html)$/.test(file)) continue
  const content = await readFile(file, 'utf8')
  if (/<uni-[a-z]/.test(content)) throw new Error(`旧 UI 组件残留: ${file}`)
  if (/lang=["']ts["']/.test(content)) throw new Error(`组件含 TS: ${file}`)
  if (/jg-admin|jg-h5|reader_flutter|talestime|epccGwMsg|bankBind|PRIVATE KEY-----/.test(content))
    throw new Error(`业务或凭证残留: ${file}`)
}
const manifestPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (manifestPackage.dependencies['@dcloudio/uni-ui'] || !manifestPackage.dependencies['uview-plus'])
  throw new Error('UI 依赖未完成迁移')
const pages = JSON.parse(await readFile(resolve(root, 'src/pages.json'), 'utf8'))
for (const page of pages.pages) await readFile(resolve(root, `src/${page.path}.vue`))
for (const group of pages.subPackages)
  for (const page of group.pages) await readFile(resolve(root, `src/${group.root}/${page.path}.vue`))
const manifest = JSON.parse(await readFile(resolve(root, 'src/manifest.json'), 'utf8'))
if (manifest.uniStatistics.enable || manifest['mp-weixin'].setting.urlCheck !== true)
  throw new Error('默认统计或域名检查配置错误')
console.log(
  `Project check passed: ${source.length} source/config/asset files; routes valid; statistics disabled.`,
)
