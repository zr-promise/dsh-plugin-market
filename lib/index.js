/**
 * @dsh-external/dsh-plugin-market — DSH 插件市场宿主端（正式 bundle 版）。
 *
 * 提供环回 HTTP 路由（前缀 /market-api）：
 *   POST /market-api/search        搜索/浏览插件（收录列表 + GitHub，限定 DSH 相关，分页）
 *   POST /market-api/info          仓库详情 + README + 清单文件 + 安装形态
 *   POST /market-api/install       拉取插件源码（清单/入口文件）并识别安装形态
 *   POST /market-api/auth/login    验证并写入 GitHub PAT（github-auth.json）
 *   POST /market-api/auth/logout   注销（删除 github-auth.json）
 *   POST /market-api/config/get    读取市场配置（代理）
 *   POST /market-api/config/set    保存市场配置（代理）
 *
 * 同时注册 Agent 工具：market_search / market_info / market_install / market_debug。
 * 网络通道：subprocess + curl（-D - 响应头解析，支持代理），GitHub 限流头解析。
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, realpathSync, existsSync, statSync, symlinkSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-plugin-market'
export const inject = ['tools', 'webServer']

const UA = 'dsh-plugin-market/0.1'
const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const SEARCH_TTL = 10 * 60 * 1000
const REPO_TTL = 30 * 60 * 1000
const TREE_TTL = 30 * 60 * 1000
const MAX_CONTENT = 100 * 1024
const PER_PAGE = 20

const CURATED = [
  { fullName: 'deepseek-ai/deepseek-harness', category: '官方', note: 'DeepSeek Harness 官方仓库 · “Everything is a Plugin”' },
  { fullName: 'beancookie/awesome-dsh-plugin', category: '收录列表', note: 'DSH 插件收录列表' },
  { fullName: 'Dominic789654/awesome-deepseek-harness', category: '收录列表', note: 'DeepSeek Harness 生态收录列表' },
  { fullName: 'Noob-stupid/dsh-plugin-hub', category: '插件', note: '管理面板 + 市场 + 一键安装实现' },
  { fullName: 'hrhgit/deepseek-harness-plugin-manager', category: '插件', note: '插件 inspect / enable / disable' },
  { fullName: 'dsh-market/dsh-market', category: '收录列表', note: '市场数据源格式参考' },
]

export function apply(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) {
    console.error('dsh-plugin-market: subprocess 服务不可用，市场插件禁用')
    return
  }

  // ── 状态 ──────────────────────────────────────────────────────
  const cache = new Map()
  const staging = new Map()
  let lastLiveSearch = 0
  let authState = null
  let authToken = null
  let authLogin = null
  let configProxy = null
  let configLoaded = false

  function dshHome() {
    const h = process.env.DSH_HOME
    return h && h.trim() ? h.trim() : join(homedir(), '.dsh')
  }
  function authPath() { return join(dshHome(), 'github-auth.json') }
  function configPath() { return join(dshHome(), 'dsh-plugin-market.json') }

  function readJsonFile(p) {
    try {
      // 兼容历史文件：PowerShell 写入的 JSON 可能带 UTF-8 BOM
      const text = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
      return JSON.parse(text)
    } catch { return null }
  }
  function writeJsonFile(p, obj) {
    try {
      mkdirSync(join(p, '..'), { recursive: true })
      writeFileSync(p, JSON.stringify(obj), 'utf8')
      return { ok: true }
    } catch (err) {
      return { ok: false, stderr: String((err && err.message) || err) }
    }
  }
  function removeJsonFile(p) {
    try { rmSync(p, { force: true }); return true } catch { return false }
  }

  function cacheFresh(key, ttl) {
    const h = cache.get(key)
    return !!h && Date.now() - h.at < ttl
  }
  function cacheGet(key) {
    const h = cache.get(key)
    return h ? h.value : undefined
  }
  function cacheSet(key, value) {
    cache.set(key, { at: Date.now(), value })
  }

  function validFullName(fullName) {
    return typeof fullName === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)
  }

  // ── 认证（github-auth.json，与 dsh-github-login 兼容） ────────
  function ensureAuth() {
    if (authState !== null) return
    authState = 'anon'
    try {
      const data = readJsonFile(authPath())
      if (data && typeof data.token === 'string' && data.token) {
        authToken = data.token
        authLogin = typeof data.login === 'string' && data.login ? data.login : null
        authState = 'token'
      }
    } catch { authState = 'anon' }
  }

  // ── 市场配置（代理） ──────────────────────────────────────────
  function ensureConfig() {
    if (configLoaded) return
    configLoaded = true
    try {
      const data = readJsonFile(configPath())
      if (data && typeof data.proxy === 'string' && data.proxy) configProxy = data.proxy
    } catch { /* ignore */ }
  }
  function saveConfig(proxy) {
    const wr = writeJsonFile(configPath(), { proxy: proxy || '' })
    if (wr.ok) configProxy = proxy || null
    return wr
  }

  // ── 已安装扫描（profile bundles + 引用路径） ──────────────────
  let installedScan = null
  let installedScanAt = 0
  const INSTALLED_TTL = 60 * 1000

  function scanInstalled() {
    const now = Date.now()
    if (installedScan && now - installedScanAt < INSTALLED_TTL) return installedScan
    const out = { bundles: [], pluginSrcDirs: [], paths: [], profiles: [] }
    try {
      const profilesDir = join(dshHome(), 'profiles')
      const entries = readdirSync(profilesDir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const pj = readJsonFile(join(profilesDir, e.name, 'package.json'))
        if (!pj) continue
        const bundles = (pj.dsh && pj.dsh.profile && Array.isArray(pj.dsh.profile.bundles)) ? pj.dsh.profile.bundles : []
        const deps = (pj.dependencies && typeof pj.dependencies === 'object') ? pj.dependencies : {}
        const names = bundles.concat(Object.keys(deps))
        for (const n of names) {
          if (typeof n !== 'string' || !n) continue
          if (out.bundles.indexOf(n) < 0) out.bundles.push(n)
          // 解析被引用包的实际安装路径（link/file 目标或 node_modules realpath）
          let p = null
          const depVal = deps[n]
          if (typeof depVal === 'string') p = linkTarget(depVal)
          if (!p) {
            const pp = join(profilesDir, e.name, 'node_modules', n)
            if (existsSync(pp)) {
              try { p = realpathSync(pp) } catch { p = pp }
            }
          }
          if (p && !out.paths.some((x) => x.name === n && x.path === p)) out.paths.push({ name: n, path: p })
        }
        out.profiles.push({ name: e.name, bundles: bundles.slice() })
      }
    } catch { /* ignore */ }
    try {
      const srcDir = join(dshHome(), 'plugin-src')
      const entries = readdirSync(srcDir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) out.pluginSrcDirs.push(e.name)
      }
    } catch { /* ignore */ }
    installedScan = out
    installedScanAt = now
    return out
  }

  // 「已安装」= 被 profile 引用。匹配依据：
  // ① 包名尾段（完整段，不去前缀）与 repo 名精确相等，或长段（≥6）双向包含；
  // ② 被引用包的实际安装路径中任一目录段 === repo 名（覆盖皮肤类：包名与仓库名无关，
  //    如 @dsh-external/dsh-client-ui-skin-maid-atelier 装在 plugin-src/dsh-deep-whale/ 下）。
  // 卸载后引用消失 → 不再匹配（plugin-src 残留目录不算已安装）。
  function isInstalled(item) {
    if (!item || typeof item.fullName !== 'string') return false
    const scan = scanInstalled()
    const repo = item.fullName.split('/').pop().toLowerCase()
    if (!repo) return false
    for (const ref of scan.paths) {
      const seg = (ref.name.toLowerCase().split('/').pop() || '')
      if (seg && seg === repo) return true
      if (seg && seg.length >= 6 && repo.length >= 6 && (seg.indexOf(repo) >= 0 || repo.indexOf(seg) >= 0)) return true
      if (ref.path) {
        const parts = ref.path.replace(/\\/g, '/').toLowerCase().split('/')
        if (parts.indexOf(repo) >= 0) return true
      }
    }
    return false
  }

  function withInstalled(items) {
    for (const it of items) {
      if (it && !('installed' in it)) it.installed = isInstalled(it)
    }
    return items
  }

  // ── 插件管理：已安装第三方插件（列表 / 更新检查 / 卸载） ─────
  const UPDATE_TTL = 60 * 60 * 1000
  const updateCache = new Map()

  function linkTarget(dep) {
    if (typeof dep !== 'string') return null
    if (dep.indexOf('link:') === 0) return dep.slice(5)
    if (dep.indexOf('file:') === 0) return dep.slice(5)
    return null
  }

  // 从 package.json 提取 GitHub 仓库 fullName（repository / homepage）
  function repoFromPackage(pj) {
    if (!pj || typeof pj !== 'object') return null
    let url = null
    if (typeof pj.repository === 'string') url = pj.repository
    else if (pj.repository && typeof pj.repository.url === 'string') url = pj.repository.url
    if (!url && typeof pj.homepage === 'string' && pj.homepage.indexOf('github.com') >= 0) url = pj.homepage
    if (!url || typeof url !== 'string') return null
    const m = /(?:github\.com|git@github\.com)[\/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(url.trim().replace(/^git\+/, ''))
    return m ? (m[1] + '/' + m[2]) : null
  }

  // 在插件目录下找 package.json（根目录或一层子目录，如 maid-atelier/）
  function findPackageJson(dir) {
    const root = join(dir, 'package.json')
    if (existsSync(root)) return { path: root, pj: readJsonFile(root) }
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.')) continue
        const p = join(dir, e.name, 'package.json')
        if (existsSync(p)) return { path: p, pj: readJsonFile(p) }
      }
    } catch { /* ignore */ }
    return null
  }

  // 递归最新 mtime（跳过 .git / node_modules）
  function newestMtime(dir, depth) {
    const d = depth || 0
    if (d > 3) return 0
    let best = 0
    try {
      const st = statSync(dir)
      if (st.isFile()) return st.mtimeMs
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.name === '.git' || e.name === 'node_modules') continue
        const full = join(dir, e.name)
        const t = newestMtime(full, d + 1)
        if (t > best) best = t
      }
    } catch { /* ignore */ }
    return best
  }

  // 列出所有已安装的第三方插件（非 @deepseek-ai/*）
  function listInstalledPlugins() {
    const out = []
    const seen = new Set()
    const profilesDir = join(dshHome(), 'profiles')
    let profileEntries = []
    try {
      profileEntries = readdirSync(profilesDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch { /* ignore */ }
    for (const e of profileEntries) {
      const pj = readJsonFile(join(profilesDir, e.name, 'package.json'))
      if (!pj) continue
      const bundles = (pj.dsh && pj.dsh.profile && Array.isArray(pj.dsh.profile.bundles)) ? pj.dsh.profile.bundles : []
      const deps = (pj.dependencies && typeof pj.dependencies === 'object') ? pj.dependencies : {}
      const names = []
      for (const b of bundles) if (typeof b === 'string' && b) names.push({ name: b, from: 'bundle' })
      for (const d of Object.keys(deps)) names.push({ name: d, from: 'dependency' })
      for (const n of names) {
        if (n.name.indexOf('@deepseek-ai/') === 0) continue // 官方内置不算第三方
        let path = null
        const depVal = deps[n.name]
        if (typeof depVal === 'string') path = linkTarget(depVal)
        if (!path) {
          const p = join(profilesDir, e.name, 'node_modules', n.name)
          if (existsSync(p)) {
            try { path = realpathSync(p) } catch { path = p }
          }
        }
        const key = n.name + '@' + (path || '')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(describeInstalledPlugin(n.name, path, e.name, n.from))
      }
    }
    // 补充：plugin-src 中未被 profile 引用的源码目录
    try {
      const srcDir = join(dshHome(), 'plugin-src')
      const entries = readdirSync(srcDir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue
        // 路径统一为斜杠再匹配（link 路径可能是 C:/… 正斜杠，sep 是反斜杠）
        if (out.some((o) => o.path && o.path.replace(/\\/g, '/').toLowerCase().indexOf('/' + e.name.toLowerCase()) >= 0)) continue
        const p = join(srcDir, e.name)
        out.push(describeInstalledPlugin(e.name, p, null, 'src'))
      }
    } catch { /* ignore */ }
    return out
  }

  function describeInstalledPlugin(name, path, profile, from) {
    const item = { name, path: path || null, profile: profile || null, from, referenced: from !== 'src', repoDir: null, version: null, description: null, repoFullName: null, kind: 'bundle', localUpdatedAt: null, hasPackageJson: false, pkgRelPath: null }
    if (path) {
      const found = findPackageJson(path)
      if (found && found.pj) {
        item.hasPackageJson = true
        item.version = found.pj.version || null
        item.description = found.pj.description || null
        item.repoFullName = repoFromPackage(found.pj)
        if (/skin/i.test(found.pj.name || '')) item.kind = 'skin'
        else if (found.pj.dsh && found.pj.dsh.bundle && found.pj.dsh.bundle.patch) item.kind = 'bundle'
        const rel = relative(path, found.path)
        item.pkgRelPath = rel ? rel.split(sep).join('/') : 'package.json'
      }
      // 从路径提取仓库目录名（plugin-src/<repo> 的第一段），并尝试用 .git/config 的
      // origin 地址补全完整仓库名（package.json 常缺 repository 字段，如 maid-atelier）
      const srcRoot = join(dshHome(), 'plugin-src')
      const normPath = path.replace(/\\/g, '/')
      const normRoot = srcRoot.replace(/\\/g, '/') + '/'
      if (normPath.indexOf(normRoot) === 0) {
        const rel = normPath.slice(normRoot.length)
        const repoDir = rel.split('/')[0]
        if (repoDir && repoDir !== 'node_modules') {
          item.repoDir = repoDir
          if (!item.repoFullName) {
            try {
              const cfg = readFileSync(join(srcRoot, repoDir, '.git', 'config'), 'utf8')
              const m = /url\s*=\s*(?:git\+)?(?:https?:\/\/|git@)github\.com[\/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\s|$)/i.exec(cfg)
              if (m) item.repoFullName = m[1] + '/' + m[2]
            } catch { /* ignore */ }
          }
        }
      }
      item.localUpdatedAt = Math.round(newestMtime(path))
    }
    return item
  }

  function manageListRpc() {
    return { ok: true, plugins: listInstalledPlugins() }
  }

  // 更新检查：GitHub repos（default_branch + pushed_at）+ 远程 package.json version
  async function checkPluginUpdate(plugin, signal) {
    if (!plugin.repoFullName) return Object.assign({}, plugin, { checkState: 'no-repo' })
    const key = 'update:' + plugin.repoFullName
    const now = Date.now()
    if (updateCache.has(key) && now - updateCache.get(key).at < UPDATE_TTL) {
      return Object.assign({}, plugin, updateCache.get(key).value)
    }
    const res = await ghGet('/repos/' + plugin.repoFullName, null, signal)
    if (!res.ok) {
      const value = { checkState: 'error', checkError: res.error || ('HTTP ' + res.status) }
      updateCache.set(key, { at: now, value })
      return Object.assign({}, plugin, value)
    }
    const r = res.json
    let remoteVersion = null
    let remotePath = null
    if (plugin.hasPackageJson && plugin.pkgRelPath) {
      const raw = await rawGet(plugin.repoFullName, r.default_branch || 'main', plugin.pkgRelPath, signal)
      if (raw) {
        try { remoteVersion = JSON.parse(raw).version || null } catch { /* ignore */ }
        remotePath = plugin.pkgRelPath
      }
    }
    const remotePushedAt = r.pushed_at || null
    const remoteTs = remotePushedAt ? Date.parse(remotePushedAt) : NaN
    const localTs = plugin.localUpdatedAt || 0
    const hasUpdate = Number.isFinite(remoteTs) && localTs > 0 ? remoteTs > localTs : null
    const value = {
      checkState: 'ok',
      defaultBranch: r.default_branch || 'main',
      remotePushedAt,
      remoteVersion,
      remotePath,
      hasUpdate,
      note: hasUpdate === true ? '本地更新时间早于 GitHub 最后推送，建议更新' : (hasUpdate === false ? '已是最新' : '无法比较时间'),
    }
    updateCache.set(key, { at: now, value })
    return Object.assign({}, plugin, value)
  }

  async function manageCheckUpdatesRpc(names, signal) {
    const all = listInstalledPlugins()
    const targets = Array.isArray(names) && names.length ? all.filter((p) => names.indexOf(p.name) >= 0) : all
    const results = []
    for (const p of targets) {
      results.push(await checkPluginUpdate(p, signal))
    }
    return { ok: true, plugins: results }
  }

  // 卸载：从 profile 的 bundles + dependencies 移除（官方包拒绝）
  // 删除 plugin-src 下的源码残留目录（未被任何 profile 引用）
  function manageRemoveSrcRpc(dirName) {
    if (typeof dirName !== 'string' || !dirName.trim()) return { ok: false, error: '缺少目录名' }
    dirName = dirName.trim()
    if (dirName.indexOf('/') >= 0 || dirName.indexOf('\\') >= 0 || dirName === '.' || dirName === '..') {
      return { ok: false, error: '目录名不合法' }
    }
    const srcRoot = join(dshHome(), 'plugin-src')
    const target = join(srcRoot, dirName)
    if (target.indexOf(srcRoot + sep) !== 0) return { ok: false, error: '路径越界' }
    if (!existsSync(target)) return { ok: false, error: '目录不存在：' + dirName }
    if (!statSync(target).isDirectory()) return { ok: false, error: '不是目录：' + dirName }
    // 安全：确认没有被任何 profile 引用（已安装的必须走「卸载」）
    const scan = scanInstalled()
    const norm = target.replace(/\\/g, '/').toLowerCase()
    const referenced = scan.paths.some((p) => p.path && p.path.replace(/\\/g, '/').toLowerCase().indexOf(norm) === 0)
    if (referenced) return { ok: false, error: '该目录正被 profile 引用（已安装），请使用「卸载」按钮' }
    try {
      rmSync(target, { recursive: true, force: true })
    } catch (err) {
      return { ok: false, error: '删除失败：' + String((err && err.message) || err) }
    }
    return { ok: true, removed: target, note: '已删除源码目录：' + target }
  }

  function manageUninstallRpc(name) {
    if (typeof name !== 'string' || !name.trim()) return { ok: false, error: '缺少插件名' }
    name = name.trim()
    if (name.indexOf('@deepseek-ai/') === 0) return { ok: false, error: '官方内置插件不可卸载' }
    // 卸载前记录被引用包的实际安装路径（用于源码清理）
    const before = scanInstalled()
    const ref = before.paths.find((x) => x.name === name)
    const profilesDir = join(dshHome(), 'profiles')
    const touched = []
    let found = false
    try {
      const entries = readdirSync(profilesDir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const pkgPath = join(profilesDir, e.name, 'package.json')
        const pj = readJsonFile(pkgPath)
        if (!pj) continue
        let changed = false
        if (pj.dsh && pj.dsh.profile && Array.isArray(pj.dsh.profile.bundles)) {
          const beforeN = pj.dsh.profile.bundles.length
          pj.dsh.profile.bundles = pj.dsh.profile.bundles.filter((b) => b !== name)
          if (pj.dsh.profile.bundles.length !== beforeN) { changed = true; found = true }
        }
        if (pj.dependencies && typeof pj.dependencies === 'object' && Object.prototype.hasOwnProperty.call(pj.dependencies, name)) {
          delete pj.dependencies[name]
          changed = true
          found = true
        }
        if (changed) {
          try {
            writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + '\n', 'utf8')
          } catch (err) {
            return { ok: false, error: '写入 ' + e.name + '/package.json 失败：' + String((err && err.message) || err) }
          }
          touched.push(e.name)
        }
      }
    } catch (err) {
      return { ok: false, error: '卸载失败：' + String((err && err.message) || err) }
    }
    if (!found) return { ok: false, error: '未在 profile 中找到该插件：' + name }

    // ── 源码清理：删除 plugin-src 下的源码副本 + node_modules link 残留 ──
    const removedDirs = []
    let cleanNote = ''
    if (ref && ref.path) {
      const srcRoot = join(dshHome(), 'plugin-src')
      const normPath = ref.path.replace(/\\/g, '/')
      const normRoot = srcRoot.replace(/\\/g, '/') + '/'
      if (normPath.indexOf(normRoot) === 0 && normPath.length > normRoot.length) {
        const rel = normPath.slice(normRoot.length)
        const repoDir = rel.split('/')[0]
        const repoPath = join(srcRoot, repoDir)
        // 该仓库目录下是否还有其他被引用包（如一个仓库多个皮肤）→ 只删本包，否则删整个仓库目录
        const others = before.paths.filter((x) => x.name !== name && x.path && x.path.replace(/\\/g, '/').indexOf(normRoot + repoDir + '/') === 0)
        let target = null
        if (others.length === 0) {
          target = repoPath
        } else {
          const pkgRel = rel.split('/').slice(1).join('/')
          if (pkgRel) target = join(srcRoot, repoDir, ...rel.split('/').slice(1))
        }
        if (target) {
          try {
            rmSync(target, { recursive: true, force: true })
            removedDirs.push(target)
          } catch (err) {
            cleanNote = '（源码删除失败：' + String((err && err.message) || err).slice(0, 200) + '，可手动删除 ' + target + '）'
          }
        }
      } else {
        cleanNote = '（包不在 plugin-src 下，未删除源码）'
      }
      // 清理 profile node_modules 里的 link/junction 残留（并清 pnpm 状态缓存，
      // 否则下次 install 增量不重建该 link）
      try {
        const pEntries = readdirSync(profilesDir, { withFileTypes: true })
        for (const e of pEntries) {
          if (!e.isDirectory()) continue
          const nm = join(profilesDir, e.name, 'node_modules', name)
          if (existsSync(nm)) rmSync(nm, { recursive: true, force: true })
          clearPnpmState(join(profilesDir, e.name))
        }
      } catch { /* ignore */ }
    }
    installedScan = null
    return {
      ok: true,
      profiles: touched,
      removedDirs,
      restartRequired: true,
      note: '已从 profile 移除' + (removedDirs.length ? '，并删除源码副本：' + removedDirs.join('；') : '') + cleanNote + '。重启 DSH 后生效',
    }
  }

  async function verifyToken(token) {
    let lastErr = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      const res = await runCurl(['-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', '-H', 'Authorization: Bearer ' + token, API + '/user'], undefined, { timeoutMs: 20 })
      const netErr = describeCurlError(res)
      if (netErr) { lastErr = netErr; continue }
      let message = ''
      try {
        const j = JSON.parse(res.body)
        if (j && typeof j.message === 'string') message = j.message
      } catch { /* ignore */ }
      if (res.status === 401 || res.status === 403) {
        lastErr = 'GitHub 拒绝认证（HTTP ' + res.status + (message ? '：' + message : '') + '）。常见原因：① token 复制不完整或含多余空格/换行；② 新创建的 token 有 1-2 分钟传播延迟；③ fine-grained token 权限不足（' + (message === 'Bad credentials' ? '若持续出现请到 GitHub 重新生成 token' : '请检查 token 权限与有效期') + '）'
        continue
      }
      if (res.status === 0) { lastErr = '无法连接 GitHub，请检查网络或代理设置'; continue }
      if (res.status >= 200 && res.status < 300) {
        let login = null
        try {
          const j = JSON.parse(res.body)
          login = (j && j.login) || null
        } catch { /* ignore */ }
        return { ok: true, login }
      }
      lastErr = 'GitHub 返回 HTTP ' + res.status + (message ? '：' + message : '')
    }
    return { ok: false, error: lastErr || '验证失败' }
  }

  // ── 网络通道：subprocess + curl ───────────────────────────────
  async function runCurl(args, signal, opts) {
    const o = opts || {}
    const exePath = o.exe || (await subprocess.resolveExecutable('curl'))
    let handle
    try {
      handle = subprocess.spawn({
        argv: [exePath, '-sS', '-D', '-', '-L', '--connect-timeout', '10', '--max-time', String(o.timeoutMs || 40)].concat(proxyArgs(), args),
        cwd: tmpdir(),
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 8 * 1024 * 1024 },
          stderr: { maxBytes: 128 * 1024 },
        },
        graceMs: 2000,
        signal,
      })
    } catch (err) {
      throw new Error('启动 curl 失败：' + String((err && err.message) || err))
    }
    const outcome = await handle.done
    const out = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
    const errOut = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
    const text = (out && out.text) || ''
    const parsed = parseCurlOutput(text)
    return {
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      status: parsed.status,
      body: parsed.body,
      quota: parsed.quota,
      stderr: ((errOut && errOut.text) || '').slice(-2000),
      lossy: !!(out && out.lossy),
    }
  }

  function parseCurlOutput(text) {
    // -L 跟随重定向时 -D - 输出多个头块（301 + 200…）：取最后一个分隔，状态行取最后一个
    const headEnd = text.lastIndexOf('\r\n\r\n')
    let headers = text
    let body = ''
    if (headEnd >= 0) {
      headers = text.slice(0, headEnd)
      body = text.slice(headEnd).replace(/^\r?\n/, '')
    }
    const all = [...headers.matchAll(/^HTTP\/\S+ (\d{3})/gm)]
    const sm = all.length ? all[all.length - 1] : null
    let quota = null
    if (sm) {
      const rem = /^x-ratelimit-remaining:\s*(\d+)/im.exec(headers)
      const lim = /^x-ratelimit-limit:\s*(\d+)/im.exec(headers)
      const rst = /^x-ratelimit-reset:\s*(\d+)/im.exec(headers)
      const rsc = /^x-ratelimit-resource:\s*(\S+)/im.exec(headers)
      if (rem) quota = { remaining: parseInt(rem[1], 10), limit: lim ? parseInt(lim[1], 10) : null, resetAt: rst ? parseInt(rst[1], 10) : null, resource: rsc ? rsc[1] : null }
    }
    return { body, status: sm ? parseInt(sm[1], 10) : 0, quota }
  }

  function describeCurlError(res) {
    const detail = ' exit=' + res.exitCode + ' status=' + res.status + (res.stderr ? ' stderr=' + res.stderr.slice(0, 400) : '') + (res.body ? ' bodyHead=' + res.body.slice(0, 150) : '')
    if (res.exitCode === 7 || (res.exitCode === 0 && res.status === 0 && !res.body && !res.stderr)) {
      return '网络通道异常（' + detail + '）。请检查本机网络/代理；中国大陆访问 GitHub 建议在市场页配置代理。'
    }
    if (res.exitCode === 28) return '请求超时（curl exit 28）。' + (res.stderr ? ' 详情：' + res.stderr.slice(0, 300) : '')
    if (res.exitCode !== 0) return 'curl 失败（' + detail + '）。' + (res.stderr ? ' 详情：' + res.stderr.slice(0, 300) : '')
    return null
  }

  function authHeaders() {
    return authToken ? ['-H', 'Authorization: Bearer ' + authToken] : []
  }

  function proxyArgs() {
    return configProxy ? ['--proxy', configProxy] : []
  }

  function searchGap() {
    return authToken ? 2000 : 7000
  }

  async function ghGet(path, params, signal) {
    ensureAuth()
    ensureConfig()
    let url = API + path
    if (params) {
      const qs = Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&')
      url += '?' + qs
    }
    const res = await runCurl(['-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'].concat(authHeaders(), [url]), signal)
    const netErr = describeCurlError(res)
    if (netErr) return { ok: false, error: netErr }
    if (res.status === 0) return { ok: false, status: 0, error: 'curl 未返回 HTTP 状态（exit ' + res.exitCode + '，stderr: ' + (res.stderr || '(空)') + '）' }
    if (!res.body) return { ok: false, error: 'GitHub API 返回空响应（HTTP ' + res.status + '）' }
    let json
    try {
      json = JSON.parse(res.body)
    } catch {
      return { ok: false, error: 'GitHub API 响应不是 JSON（HTTP ' + res.status + '）：' + res.body.slice(0, 300) }
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json, quota: res.quota }
  }

  async function rawGet(fullName, ref, path, signal) {
    const url = RAW + '/' + fullName + '/' + ref + '/' + path.split('/').map(encodeURIComponent).join('/')
    const res = await runCurl(['-A', UA, '--max-time', '15', url], signal, { timeoutMs: 15 })
    if (res.exitCode !== 0 || res.status !== 200 || !res.body) return null
    return res.body.length > MAX_CONTENT ? res.body.slice(0, MAX_CONTENT) : res.body
  }

  // ── 业务：条目/搜索/详情/形态/安装 ────────────────────────────
  function curatedItem(c) {
    const parts = c.fullName.split('/')
    return {
      fullName: c.fullName, name: parts[1], owner: parts[0], description: c.note,
      stars: null, forks: null, language: null, topics: [],
      url: 'https://github.com/' + c.fullName, updatedAt: null,
      source: 'curated', category: c.category,
    }
  }

  function githubItem(r) {
    return {
      fullName: r.full_name, name: r.name, owner: r.owner ? r.owner.login : '',
      description: r.description || '',
      stars: typeof r.stargazers_count === 'number' ? r.stargazers_count : null,
      forks: typeof r.forks_count === 'number' ? r.forks_count : null,
      language: r.language || null,
      topics: Array.isArray(r.topics) ? r.topics : [],
      url: r.html_url || ('https://github.com/' + r.full_name),
      updatedAt: r.updated_at || null,
      source: 'github', category: null,
      installKind: null,
    }
  }

  function isDshRelated(r) {
    const topics = Array.isArray(r.topics) ? r.topics : []
    for (const t of topics) {
      if (t === 'dsh' || t === 'dsh-plugin' || t === 'dsh-plugins' || t === 'deepseek-harness' || t === 'cordis' || t === 'cordis-plugin') return true
    }
    const hay = ((r.full_name || '') + ' ' + (r.name || '') + ' ' + (r.description || '')).toLowerCase()
    return hay.indexOf('dsh') >= 0 || hay.indexOf('cordis') >= 0 || hay.indexOf('deepseek-harness') >= 0
  }

  function mergeItems(a, b) {
    const seen = new Set()
    const out = []
    for (const it of a.concat(b)) {
      if (seen.has(it.fullName)) continue
      seen.add(it.fullName)
      out.push(it)
    }
    return out
  }

  async function enrichedCurated(signal) {
    const jobs = CURATED.map(async (c) => {
      const it = curatedItem(c)
      try {
        const info = await repoInfo(c.fullName, signal)
        if (info.ok) {
          it.stars = info.info.stars
          it.forks = info.info.forks
          it.language = info.info.language
          it.topics = info.info.topics
          it.updatedAt = info.info.updatedAt
        }
      } catch { /* 降级 */ }
      return it
    })
    return await Promise.all(jobs)
  }

  // 安装形态：dynamic（cordis.yml/plugin.yml）/ bundle（npm 包或 cordis.patch.yml 皮肤）/ list
  // 形态检测。treePaths（git/trees API 的完整 blob 路径，可靠）优先于 files（raw 内容，
  // 可能因 raw 限流 429 拉取失败）；动态入口只认根级或 plugin/ 前缀，避免子目录示例误判。
  function detectInstallKind(files, pkgContent, treePaths) {
    const paths = files.map((f) => f.path.toLowerCase())
    const tp = Array.isArray(treePaths) && treePaths.length ? treePaths.map((p) => String(p).toLowerCase()) : paths
    const hasDynamic = tp.some((p) => {
      return p === 'cordis.yml' || p === 'cordis.yaml' || p === 'plugin.yml' || p === 'plugin.yaml' || p === 'plugin.json' || /^plugin\/[^/]+\.ya?ml$/.test(p)
    })
    if (hasDynamic) {
      return { kind: 'dynamic', hint: '动态 Cordis 插件：源码可直接用于 cordis_define 定义 Package，再 cordis_run 激活（Client 半侧首次运行需批准）。' }
    }
    let pj = null
    if (pkgContent) {
      try { pj = JSON.parse(pkgContent) } catch { /* ignore */ }
    }
    if (pj && (pj.dsh || typeof pj.main === 'string' || (pj.exports && typeof pj.exports === 'object'))) {
      return { kind: 'bundle', hint: 'npm Bundle 插件：需以 npm 包方式安装（dsh plugin add 或写入 profile 的 dsh.profile.bundles + cordis.patch.yml），不适合 define 为动态插件。' }
    }
    if (tp.some((p) => /cordis\.patch\.ya?ml$/.test(p) || /\.patch\.ya?ml$/.test(p))) {
      return { kind: 'bundle', hint: 'Bundle 皮肤/补丁插件：含 cordis.patch.yml 的 bundle 形态。若为子目录皮肤（如 maid-atelier/），用 dsh plugin add <仓库>/<皮肤目录> 安装；否则 dsh plugin add <仓库>。' }
    }
    return { kind: 'list', hint: '收录/资料类仓库：非可安装插件，仅提供信息参考。' }
  }

  async function searchRepos(query, refresh, page, signal) {
    ensureConfig()
    const q = typeof query === 'string' ? query.trim() : ''
    const pg = Math.max(1, Math.floor(Number(page) || 1))
    const curated = await enrichedCurated(signal)
    const curatedMatches = q
      ? curated.filter((c) => (c.fullName + ' ' + c.description).toLowerCase().indexOf(q.toLowerCase()) >= 0)
      : curated
    const key = q ? ('search:' + q.toLowerCase() + ':p' + pg) : ('search:__all__:p' + pg)
    if (!refresh && cacheFresh(key, SEARCH_TTL)) {
      const hit = cacheGet(key)
      return { items: withInstalled(mergeItems(curatedMatches, hit.items)), live: false, source: 'cache', page: pg, hasMore: hit.hasMore, totalCount: hit.totalCount, auth: authState, login: authLogin, quota: hit.quota }
    }
    const now = Date.now()
    if (!refresh && now - lastLiveSearch < searchGap()) {
      const hit = cacheGet(key)
      if (hit) return { items: withInstalled(mergeItems(curatedMatches, hit.items)), live: false, source: 'cache', page: pg, hasMore: hit.hasMore, totalCount: hit.totalCount, throttled: true, auth: authState, login: authLogin, quota: hit.quota }
      return { items: withInstalled(curatedMatches), live: false, source: 'curated', page: pg, hasMore: false, throttled: true, note: 'GitHub 搜索限流保护中，稍后重试可获取更多结果', auth: authState, login: authLogin, quota: null }
    }
    lastLiveSearch = now
    const base = { sort: 'stars', order: 'desc', per_page: PER_PAGE, page: pg }
    let raw = []
    let totalCount = 0
    let quota = null
    if (!q) {
      const res = await ghGet('/search/repositories', Object.assign({ q: 'topic:dsh-plugin' }, base), signal)
      if (!res.ok) {
        return { items: withInstalled(curatedMatches), live: false, error: 'GitHub 搜索失败：' + (res.error || (res.json && res.json.message) || ('HTTP ' + res.status)) + '（' + (authToken ? '认证限流：搜索 30 次/分钟' : '未认证限流：搜索 10 次/分钟、API 60 次/小时') + '）', auth: authState, login: authLogin, quota: null }
      }
      raw = (res.json.items || []).map(githubItem)
      totalCount = typeof res.json.total_count === 'number' ? res.json.total_count : 0
      quota = res.quota
    } else {
      const precise = await ghGet('/search/repositories', Object.assign({ q: q + ' topic:dsh-plugin' }, base), signal)
      if (!precise.ok) {
        return { items: withInstalled(curatedMatches), live: false, error: 'GitHub 搜索失败：' + (precise.error || (precise.json && precise.json.message) || ('HTTP ' + precise.status)) + '（' + (authToken ? '认证限流：搜索 30 次/分钟' : '未认证限流：搜索 10 次/分钟、API 60 次/小时') + '）', auth: authState, login: authLogin, quota: null }
      }
      raw = (precise.json.items || []).map(githubItem)
      totalCount = typeof precise.json.total_count === 'number' ? precise.json.total_count : 0
      quota = precise.quota
      if (raw.length < 5 && pg === 1) {
        const broad = await ghGet('/search/repositories', Object.assign({ q: q + ' in:name,description,readme' }, base), signal)
        if (broad.ok) {
          raw = (broad.json.items || []).filter(isDshRelated).map(githubItem)
          totalCount = typeof broad.json.total_count === 'number' ? broad.json.total_count : 0
          quota = broad.quota
        }
      }
    }
    const hasMore = raw.length >= PER_PAGE && pg < 10
    cacheSet(key, { items: raw, hasMore, totalCount, quota })
    return { items: withInstalled(mergeItems(curatedMatches, raw)), live: true, source: 'github', page: pg, hasMore, totalCount, auth: authState, login: authLogin, quota }
  }

  async function repoInfo(fullName, signal) {
    const key = 'repo:' + fullName
    if (cacheFresh(key, REPO_TTL)) return cacheGet(key)
    const res = await ghGet('/repos/' + fullName, null, signal)
    if (!res.ok) {
      const msg = res.error || (res.json && res.json.message) || ('HTTP ' + res.status)
      return { ok: false, error: '获取仓库失败：' + msg }
    }
    const r = res.json
    const info = {
      fullName: r.full_name, name: r.name, owner: r.owner ? r.owner.login : '',
      description: r.description || '',
      stars: r.stargazers_count == null ? null : r.stargazers_count,
      forks: r.forks_count == null ? null : r.forks_count,
      openIssues: r.open_issues_count == null ? null : r.open_issues_count,
      watchers: r.subscribers_count == null ? null : r.subscribers_count,
      license: r.license ? (r.license.spdx_id || r.license.name) : null,
      language: r.language || null,
      topics: Array.isArray(r.topics) ? r.topics : [],
      homepage: r.homepage || null,
      htmlUrl: r.html_url || null,
      createdAt: r.created_at || null,
      updatedAt: r.updated_at || null,
      defaultBranch: r.default_branch || 'main',
      archived: !!r.archived,
    }
    const value = { ok: true, info }
    cacheSet(key, value)
    return value
  }

  function isCandidate(path) {
    const lower = path.toLowerCase()
    if (lower === 'cordis.yml' || lower === 'cordis.yaml' || lower === 'plugin.yml' || lower === 'plugin.yaml' || lower === 'plugin.json' || lower === 'dsh.config.yml' || lower === 'dsh.config.yaml' || lower === 'dsh.config.json' || lower === 'package.json') return true
    if (/^\./.test(path)) return false
    if (/\/\./.test(path)) return false
    if (/\.(ya?ml|json)$/.test(lower) && /(cordis|dsh|plugin)/.test(lower)) return true
    if (/^plugin\//.test(lower) && /cordis\.ya?ml$/.test(lower)) return true
    return false
  }

  function candidatePriority(path) {
    const lower = path.toLowerCase()
    if (lower === 'cordis.yml' || lower === 'cordis.yaml') return 0
    if (/cordis\.ya?ml$/.test(lower)) return 1
    if (/dsh\.config\./.test(lower)) return 2
    if (/^plugin\.(ya?ml|json)$/.test(lower)) return 3
    if (lower === 'package.json') return 4
    return 5
  }

  async function repoTree(fullName, branch, signal) {
    const key = 'tree:' + fullName + '@' + branch
    if (cacheFresh(key, TREE_TTL)) return cacheGet(key)
    const res = await ghGet('/repos/' + fullName + '/git/trees/' + encodeURIComponent(branch), { recursive: 1 }, signal)
    if (!res.ok) return { ok: false, error: res.error || (res.json && res.json.message) || ('HTTP ' + res.status) }
    const tree = Array.isArray(res.json.tree) ? res.json.tree : []
    const value = { ok: true, tree, truncated: !!res.json.truncated }
    cacheSet(key, value)
    return value
  }

  function entryFromPackage(pkgContent, exists) {
    const out = []
    if (!pkgContent) return out
    let pj
    try { pj = JSON.parse(pkgContent) } catch { return out }
    const picks = []
    if (typeof pj.main === 'string') picks.push(pj.main)
    if (pj.exports && typeof pj.exports === 'object') {
      for (const k of ['.', './client', './client.js']) {
        const v = pj.exports[k]
        if (typeof v === 'string') picks.push(v)
        else if (v && typeof v === 'object' && typeof v.default === 'string') picks.push(v.default)
      }
    }
    if (pj.dsh && pj.dsh.bundle && typeof pj.dsh.bundle.patch === 'string') picks.push(pj.dsh.bundle.patch)
    for (const p of picks) {
      if (typeof p !== 'string' || !p) continue
      const norm = p.indexOf('./') === 0 ? p.slice(2) : p
      if (exists(norm) && out.indexOf(norm) < 0) out.push(norm)
    }
    return out
  }

  async function collectManifest(fullName, signal) {
    // 整体超时保护：超大仓库/网络慢时不挂死 RPC
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 90000)
    const cs = signal || ac.signal
    try {
      return await collectManifestInner(fullName, cs)
    } finally {
      clearTimeout(timer)
    }
  }

  // 拉取仓库内文件内容：GitHub contents API 优先（认证配额稳定），raw 兜底
  async function fetchRepoFile(fullName, branch, path, signal) {
    let content = null
    try {
      const apiRes = await ghGet('/repos/' + fullName + '/contents/' + encodeURIComponent(path), null, signal)
      if (apiRes.ok && apiRes.json && typeof apiRes.json.content === 'string') {
        content = Buffer.from(apiRes.json.content.replace(/\s/g, ''), 'base64').toString('utf8')
      }
    } catch { /* ignore */ }
    if (content === null) content = await rawGet(fullName, branch, path, signal)
    return content
  }

  async function collectManifestInner(fullName, signal) {
    const infoRes = await repoInfo(fullName, signal)
    if (!infoRes.ok) return infoRes
    const branch = infoRes.info.defaultBranch
    const treeRes = await repoTree(fullName, branch, signal)
    if (!treeRes.ok) return treeRes
    const entries = treeRes.tree.filter((e) => e.type === 'blob')
    const exists = (p) => entries.some((e) => e.path === p)
    const candidates = entries
      .filter((e) => isCandidate(e.path))
      .sort((a, b) => candidatePriority(a.path) - candidatePriority(b.path))
    const shown = candidates.slice(0, 4)
    const files = []
    let pkgContent = null
    let pkgPath = null
    for (const c of shown) {
      const content = await rawGet(fullName, branch, c.path, signal)
      if (content === null) continue
      files.push({ path: c.path, size: c.size == null ? content.length : c.size, content })
      if (c.path === 'package.json') { pkgContent = content; pkgPath = c.path }
    }
    const extras = entryFromPackage(pkgContent, exists)
    for (const p of extras) {
      if (files.length >= 6) break
      if (files.some((f) => f.path === p)) continue
      const content = await rawGet(fullName, branch, p, signal)
      if (content === null) continue
      const entry = entries.find((e) => e.path === p) || {}
      files.push({ path: p, size: entry.size == null ? content.length : entry.size, content })
      if (p === 'package.json') { pkgContent = content; pkgPath = p }
    }
    let install = detectInstallKind(files, pkgContent, entries.map((e) => e.path))
    // 子包收集（monorepo 皮肤/插件集合）：patch 子目录 + 任意含 package.json 的子目录
    // （深度 ≤ 4，排除 scripts/、shared/、test/e2e/fixture/docs 等非插件目录）。
    // 逐包拉取 package.json 判断「可安装性」：有可加载入口（main / exports['.'] /
    // client-only 声明）且无 prepare 构建脚本、无 workspace:* 依赖。
    // 性能保护：超大仓库（>3000 blob）跳过子包收集；候选 ≤ 30；拉取并发 6 个。
    const subPackages = []
    if (install && install.kind === 'bundle' && entries.length <= 3000) {
      const BAD_DIR = /(^|\/)(test|tests|e2e|fixture|fixtures|example|examples|docs?|scripts|node_modules|\.github)(\/|$)/i
      const seen = new Set()
      for (const e of entries) {
        const p = e.path
        const isPatch = /\.patch\.ya?ml$/i.test(p)
        const isPkgJson = /\/package\.json$/.test(p)
        if (!isPatch && !isPkgJson) continue
        // patch 文件的 dir = 去掉文件名；package.json 的 dir = 去掉尾段
        const dir = isPatch ? p.split('/').slice(0, -1).join('/') : p.replace(/\/package\.json$/, '')
        if (!dir || dir.split('/').length > 4) continue
        if (BAD_DIR.test(dir + '/')) continue
        if (dir.indexOf('shared') === 0) continue
        if (seen.has(dir)) continue
        seen.add(dir)
        subPackages.push({ dir, pkgPath: dir + '/package.json', patch: isPatch ? p : null, name: null, installable: false })
        if (subPackages.length >= 30) break
      }
      // 拉取每个候选子包 package.json（contents API 优先，raw 兜底）并判断可安装性（并发 6）
      const fetchPkg = async (sp) => {
        const content = await fetchRepoFile(fullName, branch, sp.pkgPath, signal)
        if (!content) return
        try {
          const pj = JSON.parse(content)
          sp.name = typeof pj.name === 'string' ? pj.name : null
          const main = (typeof pj.main === 'string' && pj.main) ? pj.main : null
          const ex = (pj.exports && typeof pj.exports === 'object') ? pj.exports : null
          const exDef = ex ? (typeof ex['.'] === 'string' ? ex['.'] : (ex['.'] && typeof ex['.'] === 'object' ? ex['.'].default : null)) : null
          const hasEntry = (main && exists(sp.dir + '/' + main.replace(/^\.\//, ''))) || (typeof exDef === 'string' && exDef && exists(sp.dir + '/' + exDef.replace(/^\.\//, '')))
          const clientOnly = !!(ex && ex['./client'] && pj.dsh && pj.dsh.client)
          const needsBuild = !!(pj.scripts && (pj.scripts.prepare || pj.scripts.install || pj.scripts.postinstall))
          const wsDeps = !!(pj.dependencies && Object.keys(pj.dependencies).some((k) => typeof pj.dependencies[k] === 'string' && pj.dependencies[k].indexOf('workspace:') === 0))
          sp.installable = (hasEntry || clientOnly) && !needsBuild && !wsDeps
        } catch { /* ignore */ }
      }
      for (let i = 0; i < subPackages.length; i += 6) {
        await Promise.all(subPackages.slice(i, i + 6).map(fetchPkg))
      }
      subPackages.sort((a, b) => (b.installable ? 1 : 0) - (a.installable ? 1 : 0))
    }
    // 唯一可安装子包（如 maid-atelier 皮肤）：pkgPath 修正为子包 package.json
    // （根 package.json 只是集合清单，不是插件入口）
    const installableSubs = subPackages.filter((s) => s.installable)
    if (installableSubs.length === 1 && (!pkgPath || pkgPath === 'package.json')) {
      const sp = installableSubs[0]
      if (!files.some((f) => f.path === sp.pkgPath)) {
        let content = null
        try {
          const apiRes = await ghGet('/repos/' + fullName + '/contents/' + encodeURIComponent(sp.pkgPath), null, signal)
          if (apiRes.ok && apiRes.json && typeof apiRes.json.content === 'string') {
            content = Buffer.from(apiRes.json.content.replace(/\s/g, ''), 'base64').toString('utf8')
          }
        } catch { /* ignore */ }
        if (content === null) content = await rawGet(fullName, branch, sp.pkgPath, signal)
        if (content !== null) {
          files.push({ path: sp.pkgPath, size: content.length, content })
          pkgContent = content
          pkgPath = sp.pkgPath
        }
      }
    }
    const interesting = entries
      .filter((e) => /^(README|readme|LICENSE|license|CHANGELOG|changelog)/.test(e.path) || isCandidate(e.path))
      .slice(0, 30)
      .map((e) => ({ path: e.path, type: e.type, size: e.size }))
    // 子包 + 根包名的 npm 可用性（官方推荐路径：npm 已发布时 dsh plugin add <name>）。
    // 归属校验：npm 包的 repository 必须指向该仓库（owner/repo 一致），避免同名巧合误推荐。
    const repoKey = fullName.toLowerCase()
    for (const sp of subPackages) {
      if (!sp.name) continue
      const npm = await npmCheck(sp.name, signal)
      sp.npm = npm.available && npm.repo === repoKey ? npm : null
    }
    // 按包名去重（monorepo 常见同包多目录，如 packages/dsh-skins/skins/ 与 packages/skins/），
    // 保留源码可安装的那个；并给子包分类：recommended（官方聚合包）/ skin / plugin
    const byName = new Map()
    for (const sp of subPackages) {
      const key = sp.name || sp.dir
      const exist = byName.get(key)
      if (!exist || (sp.installable && !exist.installable) || (!exist.npm && sp.npm && sp.npm.available)) {
        byName.set(key, sp)
      }
    }
    const dedup = [...byName.values()]
    for (const sp of dedup) {
      if (sp.name && (/-all$/i.test(sp.name) || /\/dsh-skins$/i.test(sp.name) || /skin-center/i.test(sp.name))) sp.kind = 'recommended'
      else if (/skin/i.test(sp.name || '')) sp.kind = 'skin'
      else sp.kind = 'plugin'
    }
    // 分类排序：推荐 → 皮肤 → 插件（同类内可装的在前）
    dedup.sort((a, b) => {
      const rank = { recommended: 0, skin: 1, plugin: 2 }
      const ra = rank[a.kind] != null ? rank[a.kind] : 3
      const rb = rank[b.kind] != null ? rank[b.kind] : 3
      if (ra !== rb) return ra - rb
      return (b.installable ? 1 : 0) - (a.installable ? 1 : 0)
    })
    subPackages.length = 0
    subPackages.push(...dedup)
    // 根 bundle 预检（入口/prepare/workspace）——让 GUI 在安装前就能显示可装性与原因
    let rootInstallable = null
    let rootNpm = null
    if (install && install.kind === 'bundle') {
      try {
        let rootName = null
        let rootContent = null
        const rootPkg = files.find((f) => f.path === 'package.json')
        if (rootPkg) { rootContent = rootPkg.content; try { rootName = JSON.parse(rootContent).name || null } catch { /* ignore */ } }
        if (rootContent === null && exists('package.json')) {
          const c = await fetchRepoFile(fullName, branch, 'package.json', signal)
          if (c) { rootContent = c; try { rootName = JSON.parse(c).name || null } catch { /* ignore */ } }
        }
        if (rootContent === null) {
          rootInstallable = { ok: false, reason: '无法读取根 package.json' }
        } else {
          try {
            const rj = JSON.parse(rootContent)
            const main = (typeof rj.main === 'string' && rj.main) ? rj.main : null
            const ex = (rj.exports && typeof rj.exports === 'object') ? rj.exports : null
            const exDef = ex ? (typeof ex['.'] === 'string' ? ex['.'] : (ex['.'] && typeof ex['.'] === 'object' ? ex['.'].default : null)) : null
            const hasEntry = (main && exists(main.replace(/^\.\//, ''))) || (typeof exDef === 'string' && exDef && exists(exDef.replace(/^\.\//, '')))
            const clientOnly = !!(ex && ex['./client'] && rj.dsh && rj.dsh.client)
            const needsBuild = !!(rj.scripts && (rj.scripts.prepare || rj.scripts.install || rj.scripts.postinstall))
            const wsDeps = !!(rj.dependencies && Object.keys(rj.dependencies).some((k) => typeof rj.dependencies[k] === 'string' && rj.dependencies[k].indexOf('workspace:') === 0))
            if (hasEntry || clientOnly) {
              rootInstallable = needsBuild || wsDeps ? { ok: false, reason: '入口存在但需构建（' + (needsBuild ? 'prepare 脚本' : 'workspace 依赖') + '）' } : { ok: true }
            } else {
              rootInstallable = { ok: false, reason: '根目录无可加载入口' }
            }
          } catch { /* ignore */ }
        }
        // 仅对 bundle 且包名与仓库名相关时查询 npm，且 npm 包 repository 必须指向该仓库
        if (rootName) {
          const repoSeg = fullName.split('/')[1].toLowerCase().replace(/[^a-z0-9]+/g, '')
          const pkgSeg = (rootName.split('/').pop() || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
          if (repoSeg && pkgSeg && (pkgSeg.indexOf(repoSeg) >= 0 || repoSeg.indexOf(pkgSeg) >= 0)) {
            const npm = await npmCheck(rootName, signal)
            rootNpm = npm.available && npm.repo === repoKey ? npm : null
          }
        }
      } catch { /* ignore */ }
    }
    // 降级：bundle 特征但无可安装内容（无子包可装、无 npm 对应、根不可装且无根 npm）→
    // 收录/资料类，但 hint 说明具体原因（避免把"需构建的插件"误报为资料仓库）
    if (install && install.kind === 'bundle'
      && !subPackages.some((s) => s.installable)
      && !subPackages.some((s) => s.npm && s.npm.available)
      && rootInstallable !== null
      && !rootInstallable.ok
      && !(rootNpm && rootNpm.available)) {
      const reason = (rootInstallable && rootInstallable.reason) || '无可加载入口'
      install = { kind: 'list', hint: '检测到 DSH 插件结构，但无法一键安装：' + reason + '，且未在 npm 发布。可从源码构建后手动安装，或等待作者发布 npm 包。' }
      rootNpm = null
      rootInstallable = null
    }
    return { ok: true, fullName, branch, files, install, pkgPath, subPackages, rootNpm, rootInstallable, treeSummary: interesting, totalFiles: entries.length }
  }

  // bundle 安装命令：package.json 在子目录（皮肤）→ github:owner/repo/<子目录>
  function buildAddCmd(fullName, install, pkgPath) {
    if (!install || install.kind !== 'bundle' || typeof fullName !== 'string') return null
    if (pkgPath && pkgPath.indexOf('/') >= 0) {
      const dir = pkgPath.split('/').slice(0, -1).join('/')
      return 'dsh plugin add github:' + fullName + '/' + dir
    }
    return 'dsh plugin add github:' + fullName
  }

  async function installSource(fullName, signal) {
    const staged = staging.get(fullName)
    if (staged) return { ok: true, staged: true, fullName: staged.fullName, branch: staged.branch, files: staged.files, install: staged.install, pkgPath: staged.pkgPath, subPackages: staged.subPackages, rootNpm: staged.rootNpm, rootInstallable: staged.rootInstallable, treeSummary: staged.treeSummary, totalFiles: staged.totalFiles, hint: staged.hint, addCmd: staged.addCmd, installed: isInstalled({ fullName }) }
    const res = await collectManifest(fullName, signal)
    if (!res.ok) return res
    const addCmd = buildAddCmd(fullName, res.install, res.pkgPath)
    let hint = '插件源码已获取（' + res.files.length + ' 个清单/入口文件）。' + (res.install ? res.install.hint : '')
    if (res.subPackages && res.subPackages.length > 1) {
      hint += ' 该仓库是插件集合，含 ' + res.subPackages.length + ' 个子包，请在 GUI 中选择要安装的子包。'
    } else if (addCmd) {
      hint += ' 安装命令：`' + addCmd + '`（注意：本地路径含空格时务必用引号包裹，推荐直接使用该命令）。'
    }
    hint += ' 安装流程：对助手说“安装 ' + fullName + '”，助手会调用 market_install 读取源码，再执行 cordis_define 定义 Package、cordis_run 激活（Client 半侧首次运行需在 GUI 中批准）。'
    const payload = {
      ok: true, fullName, branch: res.branch,
      files: res.files.map((f) => ({ path: f.path, size: f.size, content: f.content })),
      install: res.install,
      addCmd,
      pkgPath: res.pkgPath,
      subPackages: res.subPackages || [],
      rootNpm: res.rootNpm || null,
      rootInstallable: res.rootInstallable || null,
      treeSummary: res.treeSummary, totalFiles: res.totalFiles,
      staged: false, hint,
      installed: isInstalled({ fullName }),
    }
    staging.set(fullName, payload)
    return payload
  }

  // ── 真·一键安装：clone 源码 + 写 profile + 建 junction ────────
  async function cloneGit(url, target, signal) {
    let exe
    try { exe = await subprocess.resolveExecutable('git') } catch (err) {
      return { ok: false, error: '未找到 git：' + String((err && err.message) || err) }
    }
    let handle
    try {
      handle = subprocess.spawn({
        argv: [exe, 'clone', '--depth', '1', '--single-branch', url, target],
        cwd: tmpdir(),
        stdio: { stdin: 'ignore', stdout: { maxBytes: 2 * 1024 * 1024 }, stderr: { maxBytes: 512 * 1024 } },
        graceMs: 2000,
        signal,
      })
    } catch (err) {
      return { ok: false, error: '启动 git 失败：' + String((err && err.message) || err) }
    }
    const outcome = await handle.done
    const out = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
    const errOut = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
    const errText = ((errOut && errOut.text) || '').slice(-500)
    if (outcome.exitCode !== 0) {
      return { ok: false, error: 'git clone 失败（exit ' + outcome.exitCode + '）：' + (errText || '(无错误输出)') }
    }
    return { ok: true, out: ((out && out.text) || '').slice(-200) }
  }

  // 写 profile：bundles 追加 + dependencies link（所有 profile）
  function addProfileRef(pkgName, linkPath) {
    const profilesDir = join(dshHome(), 'profiles')
    const touched = []
    const entries = readdirSync(profilesDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const pkgPath = join(profilesDir, e.name, 'package.json')
      const pj = readJsonFile(pkgPath)
      if (!pj) continue
      if (!pj.dsh) pj.dsh = {}
      if (!pj.dsh.profile) pj.dsh.profile = {}
      if (!Array.isArray(pj.dsh.profile.bundles)) pj.dsh.profile.bundles = []
      if (!pj.dependencies) pj.dependencies = {}
      let changed = false
      if (pj.dsh.profile.bundles.indexOf(pkgName) < 0) { pj.dsh.profile.bundles.push(pkgName); changed = true }
      if (!Object.prototype.hasOwnProperty.call(pj.dependencies, pkgName)) {
        pj.dependencies[pkgName] = 'link:' + linkPath.replace(/\\/g, '/')
        changed = true
      }
      if (changed) {
        writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + '\n', 'utf8')
        touched.push(e.name)
      }
    }
    return touched
  }

  // profile node_modules 下建 junction（scoped 包建 scope 目录）
  function ensureJunction(profileDir, pkgName, realPath) {
    const nm = join(profileDir, 'node_modules')
    const scope = pkgName.charAt(0) === '@' ? pkgName.split('/')[0] : null
    const base = scope ? join(nm, scope) : nm
    const target = scope ? join(base, pkgName.split('/')[1]) : join(base, pkgName)
    mkdirSync(base, { recursive: true })
    if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    symlinkSync(realPath, target, 'junction')
    return target
  }

  // ── npm 安装路径（官方推荐：插件发布到 npm 时用 dsh plugin add <name>） ──
  const npmCache = new Map()
  const NPM_TTL = 60 * 60 * 1000

  // 从 url 提取 GitHub fullName（owner/repo，小写）
  function ghRepoFromUrl(url) {
    if (typeof url !== 'string') return null
    const m = /(?:github\.com|git@github\.com)[\/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\s|$)/i.exec(url.replace(/^git\+/, ''))
    return m ? (m[1] + '/' + m[2]).toLowerCase() : null
  }

  // 查询 npm registry：包是否存在 + 最新版本 + repository 指向的 GitHub 仓库（缓存 1h）。
  // repository/homepage 用于验证 npm 包与该 GitHub 仓库的归属关系，避免同名巧合误推荐。
  async function npmCheck(name, signal) {
    if (typeof name !== 'string' || !name) return { available: false, version: null, repo: null, name: name }
    const key = 'npm:' + name
    if (npmCache.has(key) && Date.now() - npmCache.get(key).at < NPM_TTL) return npmCache.get(key).value
    let value = { available: false, version: null, repo: null, name: name }
    try {
      const res = await runCurl(['-A', UA, '--max-time', '15', 'https://registry.npmjs.org/' + encodeURIComponent(name)], signal, { timeoutMs: 15 })
      if (res.status === 200 && res.body) {
        const j = JSON.parse(res.body)
        let repo = null
        const rj = j.repository
        if (typeof rj === 'string') repo = ghRepoFromUrl(rj)
        else if (rj && typeof rj.url === 'string') repo = ghRepoFromUrl(rj.url)
        if (!repo && typeof j.homepage === 'string') repo = ghRepoFromUrl(j.homepage)
        value = { available: true, version: (j['dist-tags'] && j['dist-tags'].latest) || null, repo, name: (typeof j.name === 'string' && j.name) || name }
      }
    } catch { /* ignore */ }
    npmCache.set(key, { at: Date.now(), value })
    return value
  }

  // 通过 npm 安装（pnpm add + bundles 注册）；npm 包在 node_modules/.pnpm 由 pnpm 管理
  async function runNpmInstallRpc(pkgName) {
    if (typeof pkgName !== 'string' || !pkgName.trim()) return { ok: false, error: '缺少包名' }
    pkgName = pkgName.trim()
    if (pkgName.split('/').length > 2) return { ok: false, error: '包名不合法' }
    if (pkgName.indexOf('@deepseek-ai/') === 0) return { ok: false, error: '官方内置插件不可通过市场安装' }
    if (scanInstalled().paths.some((x) => x.name === pkgName)) {
      return { ok: false, error: '该插件已安装（' + pkgName + '），如需重装请先卸载' }
    }
    const profilesDir = join(dshHome(), 'profiles')
    const touched = []
    let lastError = null
    try {
      const entries = readdirSync(profilesDir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const profileDir = join(profilesDir, e.name)
        let r = await pnpmInstall(profileDir, undefined, [pkgName], 'add')
        if (r.ok && !profileLinkOk(profileDir, pkgName)) {
          clearPnpmState(profileDir)
          r = await pnpmInstall(profileDir, undefined, [pkgName], 'add')
        }
        if (!r.ok) { lastError = r.error; continue }
        // bundles 注册（dependencies 已由 pnpm add 写入）
        try {
          const pkgPath = join(profileDir, 'package.json')
          const pj = readJsonFile(pkgPath)
          if (pj) {
            if (!pj.dsh) pj.dsh = {}
            if (!pj.dsh.profile) pj.dsh.profile = {}
            if (!Array.isArray(pj.dsh.profile.bundles)) pj.dsh.profile.bundles = []
            if (pj.dsh.profile.bundles.indexOf(pkgName) < 0) {
              pj.dsh.profile.bundles.push(pkgName)
              writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + '\n', 'utf8')
            }
          }
        } catch (err) {
          lastError = '写入 bundles 失败：' + String((err && err.message) || err)
          continue
        }
        touched.push(e.name)
      }
    } catch (err) {
      return { ok: false, error: 'npm 安装失败：' + String((err && err.message) || err) }
    }
    if (!touched.length) {
      return { ok: false, error: 'npm 安装失败：' + (lastError || '无可用 profile') + '。已回滚，dsh 不受影响。' }
    }
    installedScan = null
    return {
      ok: true,
      pkgName,
      npm: true,
      profiles: touched,
      restartRequired: true,
      note: '已通过 npm 安装 ' + pkgName + '（bundles 已注册）。重启 DSH 后生效。若出现皮肤/插件加载异常，注意 pnpm 11 的 minimumReleaseAge 可能静默装到旧版，可在 profile 的 pnpm-workspace.yaml 设置 minimumReleaseAge: 0 后重新安装。',
    }
  }

  async function runInstallRpc(fullName, repoUrl, kindArg, pkgPathArg, signal) {
    if (kindArg === 'npm') {
      return await runNpmInstallRpc(pkgPathArg)
    }
    if (!validFullName(fullName)) return { ok: false, error: 'fullName 格式非法，应为 owner/repo' }
    if (isInstalled({ fullName })) return { ok: false, error: '该插件已安装（' + fullName + '），如需重装请先卸载' }
    // 形态与子目录：优先显式参数（GUI 已从 install 拿到），其次 staging，最后重新收集
    let kind = kindArg === 'bundle' ? 'bundle' : (typeof kindArg === 'string' && kindArg ? kindArg : null)
    let pkgPath = typeof pkgPathArg === 'string' && pkgPathArg ? pkgPathArg : null
    if (kind !== 'bundle') {
      if (kind === 'dynamic' || kind === 'list') {
        return { ok: false, error: '该仓库不是 Bundle 形态（' + kind + '），无法自动安装。动态插件请在对话中让助手 define + run。' }
      }
      const staged = staging.get(fullName)
      if (staged) {
        kind = staged.install && staged.install.kind
        if (!pkgPath) pkgPath = staged.pkgPath || null
      }
    }
    if (kind !== 'bundle') {
      const res = await collectManifest(fullName, signal)
      if (!res.ok) return res
      kind = res.install && res.install.kind
      if (!pkgPath) pkgPath = res.pkgPath || null
      if (kind === 'bundle' && !pkgPath && res.subPackages && res.subPackages.filter((s) => s.installable).length > 1) {
        const inst = res.subPackages.filter((s) => s.installable)
        return { ok: false, error: '该仓库是插件集合，含 ' + inst.length + ' 个可安装子包（如 ' + inst[0].dir + '），请在 GUI 中选择子包后再安装', subPackages: res.subPackages }
      }
    }
    if (kind !== 'bundle') {
      return { ok: false, error: '该仓库不是 Bundle 形态（' + (kind || '未知') + '），无法自动安装。动态插件请在对话中让助手 define + run。' }
    }
    // 多子包集合但未显式指定 pkgPath：要求选择（staging 无信息时重新收集，避免
    // Agent 直调 install/run 时把集合仓库当单包装根目录）
    if (!pkgPath) {
      const staged = staging.get(fullName)
      let sps = (staged && staged.subPackages) || []
      if (!sps.length) {
        try {
          const res = await collectManifest(fullName, signal)
          if (res.ok) sps = res.subPackages || []
        } catch { /* ignore */ }
      }
      const inst = sps.filter((s) => s.installable)
      if (inst.length > 1) {
        return { ok: false, error: '该仓库是插件集合，含 ' + inst.length + ' 个可安装子包，请选择要安装的子包（如 ' + inst[0].dir + '）', subPackages: sps }
      }
      if (sps.length > 0 && inst.length === 0) {
        return { ok: false, error: '该仓库的插件子包均需在仓库内构建（prepare 脚本或 workspace 依赖），无法直接一键安装', subPackages: sps }
      }
      pkgPath = (staged && staged.pkgPath) || (sps.length === 1 ? sps[0].pkgPath : null) || 'package.json'
    }
    const parts = (pkgPath || 'package.json').split('/')
    const subDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
    const repo = fullName.split('/')[1]
    if (!/^[A-Za-z0-9_.-]+$/.test(repo)) return { ok: false, error: '仓库名不合法：' + repo }
    const srcRoot = join(dshHome(), 'plugin-src')
    const target = join(srcRoot, repo)
    if (target.indexOf(srcRoot + sep) !== 0) return { ok: false, error: '目标路径越界' }
    const cleanup = () => { try { rmSync(target, { recursive: true, force: true }) } catch { /* ignore */ } }

    // 已存在目录（未引用的源码残留）→ 清掉重 clone
    if (existsSync(target)) {
      try { rmSync(target, { recursive: true, force: true }) } catch (err) {
        return { ok: false, error: '无法清理已存在的目录 ' + target + '：' + String((err && err.message) || err) }
      }
    }
    const url = (typeof repoUrl === 'string' && repoUrl.trim()) ? repoUrl.trim() : ('https://github.com/' + fullName + '.git')
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 120000)
    let cloneRes
    try {
      cloneRes = await cloneGit(url, target, ac.signal)
    } finally {
      clearTimeout(timer)
    }
    if (!cloneRes.ok) { cleanup(); return cloneRes }

    // 读本地 package.json，校验包名
    const pkgFile = subDir ? join(target, subDir, 'package.json') : join(target, 'package.json')
    const pj = readJsonFile(pkgFile)
    if (!pj || typeof pj.name !== 'string' || !pj.name.trim()) {
      cleanup()
      return { ok: false, error: '仓库中没有有效的 package.json（' + pkgFile + '），无法确定包名' }
    }
    const pkgName = pj.name.trim()
    if (pkgName.indexOf('@deepseek-ai/') === 0) {
      cleanup()
      return { ok: false, error: '该仓库的包名是官方 scope（' + pkgName + '），为避免无法卸载，请勿通过市场安装' }
    }
    if (pkgName.indexOf('/') > 0 && pkgName.charAt(0) !== '@') {
      cleanup()
      return { ok: false, error: '包名不合法：' + pkgName }
    }
    const realPath = subDir ? join(target, subDir) : target
    if (!existsSync(join(realPath, 'package.json'))) {
      cleanup()
      return { ok: false, error: '找不到插件目录：' + realPath }
    }
    // 预校验：必须是可加载的 bundle 包（有 main/exports 入口且文件存在，或有 dsh.bundle.patch），
    // 否则 dsh 启动时无法解析该 bundle → 整个 dsh 起不来
    const pjMain = (typeof pj.main === 'string' && pj.main) ? pj.main : null
    const pjExports = (pj.exports && typeof pj.exports === 'object') ? pj.exports : null
    const pjBundlePatch = (pj.dsh && pj.dsh.bundle && typeof pj.dsh.bundle.patch === 'string') ? pj.dsh.bundle.patch : null
    let entryOk = false
    if (pjMain) entryOk = existsSync(join(realPath, pjMain))
    if (!entryOk && pjExports) {
      const picks = []
      for (const k of ['.', './client', './client.js']) {
        const v = pjExports[k]
        if (typeof v === 'string') picks.push(v)
        else if (v && typeof v === 'object' && typeof v.default === 'string') picks.push(v.default)
      }
      entryOk = picks.some((p) => typeof p === 'string' && p && existsSync(join(realPath, p)))
    }
    if (!entryOk && pjBundlePatch) entryOk = existsSync(join(realPath, pjBundlePatch))
    if (!entryOk) {
      cleanup()
      return { ok: false, error: '该包的入口文件缺失（main/exports/dsh.bundle.patch 指向的文件不存在），dsh 将无法加载它，已拒绝安装' }
    }

    // 包自身有普通 dependencies（saxes/tar/undici 这类）时，在包目录安装它们——
    // link 方式的包不会自动带上自身依赖，缺了会导致 dsh 启动加载失败（闪退）。
    const pkgDeps = (pj.dependencies && typeof pj.dependencies === 'object') ? Object.keys(pj.dependencies) : []
    if (pkgDeps.length) {
      const r = await pnpmInstall(realPath, signal, ['--prod', '--ignore-scripts'])
      if (!r.ok) {
        cleanup()
        return { ok: false, error: '安装包依赖失败：' + r.error + '。该包声明了依赖：' + pkgDeps.join(', ') + '，已回滚。' }
      }
    }
    // 解析预校验：入口的直接裸包依赖必须能从插件目录解析（Node 解析器实测）
    const vRes = await verifyBundleResolvable(realPath, pj)
    if (!vRes.ok) {
      cleanup()
      return { ok: false, error: vRes.error }
    }

    // 写 profile
    let touched = []
    try {
      touched = addProfileRef(pkgName, realPath)
    } catch (err) {
      cleanup()
      return { ok: false, error: '写入 profile 失败：' + String((err && err.message) || err) }
    }
    // pnpm install 同步依赖（lockfile + node_modules link）——手动 junction 不够，
    // dsh 启动按 pnpm 依赖树解析 bundle，缺失会直接闪退。失败则回滚 profile 引用。
    // 注意：pnpm 增量 install 在 link 被外部删除（如 repair 清理）后可能不重建
    // （状态文件认为已同步），必须验证 link 实际存在，缺失则清状态缓存重试。
    let syncError = null
    let syncedProfiles = []
    for (const pName of touched) {
      const profileDir = join(dshHome(), 'profiles', pName)
      let r = await pnpmInstall(profileDir, signal)
      if (r.ok && !profileLinkOk(profileDir, pkgName)) {
        clearPnpmState(profileDir)
        r = await pnpmInstall(profileDir, signal)
        if (r.ok && !profileLinkOk(profileDir, pkgName)) {
          r = { ok: false, error: 'pnpm install 未建立 ' + pkgName + ' 的 node_modules 链接（可能因历史状态残留，已重试仍失败）' }
        }
      }
      if (!r.ok) { syncError = r.error; break }
      syncedProfiles.push(pName)
    }
    if (syncError) {
      try {
        removeProfileRef(pkgName)
      } catch { /* ignore */ }
      cleanup()
      return { ok: false, error: '依赖同步失败（pnpm install）：' + syncError + '。已回滚 profile 引用，dsh 不受影响。' }
    }
    installedScan = null
    return {
      ok: true,
      fullName,
      pkgName,
      path: realPath,
      profiles: touched,
      syncedProfiles,
      restartRequired: true,
      note: '已安装 ' + pkgName + '（源码：' + realPath + '，依赖已同步）。重启 DSH 后生效。',
    }
  }

  // 验证 profile node_modules 中某包的链接真实可用（junction/link 目标存在且含 package.json）
  function profileLinkOk(profileDir, pkgName) {
    const nm = join(profileDir, 'node_modules', pkgName)
    if (!existsSync(nm)) return false
    try {
      const real = realpathSync(nm)
      return existsSync(join(real, 'package.json'))
    } catch { return false }
  }

  // 清除 pnpm 的 node_modules 状态缓存（link 被外部删除后增量 install 不会重建，
  // 清掉状态文件强制 pnpm 重新对齐 node_modules）
  function clearPnpmState(profileDir) {
    const nm = join(profileDir, 'node_modules')
    for (const f of ['.modules.yaml', '.pnpm-workspace-state-v1.json', '.package-map.json']) {
      try { rmSync(join(nm, f), { force: true }) } catch { /* ignore */ }
    }
  }

  // 在指定目录运行 pnpm 命令（install / add 等，注册 link 依赖 / 安装包依赖 + 更新 lockfile）。
  // Windows 上 pnpm 是 pnpm.CMD（PATHEXT 解析），Node spawn 不能直接执行 .cmd/.bat
  // （EINVAL），必须经 cmd.exe /c 包装；POSIX 直接执行 pnpm。
  async function pnpmInstall(dir, signal, extraArgs, command) {
    const args = (extraArgs || []).slice()
    const cmd = command || 'install'
    let argv
    if (process.platform === 'win32') {
      let cmdExe
      try { cmdExe = await subprocess.resolveExecutable('cmd') } catch (err) {
        return { ok: false, error: '未找到 cmd.exe：' + String((err && err.message) || err) }
      }
      argv = [cmdExe, '/d', '/s', '/c', ('pnpm ' + cmd + ' ' + args.join(' ')).trim()]
    } else {
      let exe
      try { exe = await subprocess.resolveExecutable('pnpm') } catch (err) {
        return { ok: false, error: '未找到 pnpm：' + String((err && err.message) || err) }
      }
      argv = [exe, cmd].concat(args)
    }
    let handle
    try {
      handle = subprocess.spawn({
        argv,
        cwd: dir,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 2 * 1024 * 1024 }, stderr: { maxBytes: 512 * 1024 } },
        graceMs: 2000,
        signal,
      })
    } catch (err) {
      return { ok: false, error: '启动 pnpm 失败：' + String((err && err.message) || err) }
    }
    const outcome = await handle.done
    const errOut = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
    const errText = ((errOut && errOut.text) || '').slice(-600)
    if (outcome.exitCode !== 0) {
      return { ok: false, error: 'pnpm install 失败（exit ' + outcome.exitCode + '）：' + (errText || '(无错误输出)') }
    }
    return { ok: true }
  }

  // 提取入口文件中的裸包 import（保守：只取常见的 import/export from 与动态 import）
  function extractBareImports(source) {
    const out = []
    const re = /(?:import|export)\s+(?:[\w$*{},\s]+\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    let m
    while ((m = re.exec(source))) {
      const s = m[1] || m[2]
      if (!s) continue
      if (s.charAt(0) === '.' || s.charAt(0) === '/' || s.indexOf('node:') === 0 || s.indexOf('file:') === 0) continue
      if (out.indexOf(s) < 0) out.push(s)
    }
    return out
  }

  // 预校验：入口文件及其直接裸包依赖必须能从插件目录解析（用 Node 解析器实测）。
  // link 方式的包不会自动安装自身 dependencies，缺依赖会导致 dsh 启动加载失败（闪退）。
  async function verifyBundleResolvable(realPath, pj) {
    const main = (typeof pj.main === 'string' && pj.main) ? pj.main : null
    const entry = main && existsSync(join(realPath, main))
      ? join(realPath, main)
      : (() => {
        const ex = pj.exports && typeof pj.exports === 'object' ? pj.exports : null
        if (!ex) return null
        const v = typeof ex['.'] === 'string' ? ex['.'] : (ex['.'] && typeof ex['.'] === 'object' ? ex['.'].default : null)
        return (typeof v === 'string' && v && existsSync(join(realPath, v))) ? join(realPath, v) : null
      })()
    if (!entry) return { ok: false, error: '无法确定可解析的入口文件（main/exports 均缺失或不存在）' }
    let source
    try { source = readFileSync(entry, 'utf8') } catch {
      return { ok: false, error: '无法读取入口文件：' + entry }
    }
    const specs = extractBareImports(source)
    const missing = []
    // 注意：import.meta.resolve(spec, parent) 的第二参数实测被忽略（按当前模块解析），
    // 必须用 createRequire(入口路径) 才能从插件目录解析（resolve 不执行代码）。
    let req
    try { req = createRequire(entry) } catch { req = null }
    for (const s of specs) {
      try {
        if (!req) throw new Error('no require')
        req.resolve(s)
      } catch { missing.push(s) }
    }
    if (missing.length) {
      return { ok: false, error: '入口依赖无法解析：' + missing.join(', ') + '。该包需要这些依赖（link 安装不会自动带上），已拒绝安装以免 dsh 启动失败' }
    }
    return { ok: true }
  }

  // 从所有 profile 移除引用（回滚用）
  function removeProfileRef(pkgName) {
    const profilesDir = join(dshHome(), 'profiles')
    const entries = readdirSync(profilesDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const pkgPath = join(profilesDir, e.name, 'package.json')
      const pj = readJsonFile(pkgPath)
      if (!pj) continue
      let changed = false
      if (pj.dsh && pj.dsh.profile && Array.isArray(pj.dsh.profile.bundles)) {
        const before = pj.dsh.profile.bundles.length
        pj.dsh.profile.bundles = pj.dsh.profile.bundles.filter((b) => b !== pkgName)
        if (pj.dsh.profile.bundles.length !== before) changed = true
      }
      if (pj.dependencies && typeof pj.dependencies === 'object' && Object.prototype.hasOwnProperty.call(pj.dependencies, pkgName)) {
        delete pj.dependencies[pkgName]
        changed = true
      }
      if (changed) writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + '\n', 'utf8')
    }
  }

  async function infoRpc(fullName) {
    const infoRes = await repoInfo(fullName, undefined)
    if (!infoRes.ok) return infoRes
    const branch = infoRes.info.defaultBranch
    let readme = null
    let readmePath = 'README.md'
    const rm = await rawGet(fullName, branch, 'README.md', undefined)
    if (rm === null) {
      const rm2 = await rawGet(fullName, branch, 'readme.md', undefined)
      if (rm2 !== null) { readme = rm2; readmePath = 'readme.md' }
    } else {
      readme = rm
    }
    const treeRes = await repoTree(fullName, branch, undefined)
    let files = []
    if (treeRes.ok) {
      files = treeRes.tree.filter((e) => e.type === 'blob' && (isCandidate(e.path) || /^(README|readme|LICENSE|license)/.test(e.path)))
        .slice(0, 30)
        .map((e) => ({ path: e.path, size: e.size }))
    }
    let install = null
    if (treeRes.ok && files.length) {
      const man = await collectManifest(fullName, undefined)
      if (man.ok) install = man.install
    }
    return { ok: true, info: infoRes.info, readme, readmePath, files, install, totalFiles: treeRes.ok ? treeRes.tree.length : null, installed: isInstalled({ fullName }) }
  }

  async function loginRpc(token) {
    const t = typeof token === 'string' ? token.trim() : ''
    if (!t || t.length < 10) return { ok: false, error: 'token 格式不对（应形如 ghp_xxxxxxxx）' }
    const v = await verifyToken(t)
    if (!v.ok) return v
    const wr = writeJsonFile(authPath(), { token: t, login: v.login || '' })
    if (!wr.ok) return { ok: false, error: '写入 github-auth.json 失败' + (wr.stderr ? '：' + wr.stderr.slice(0, 300) : '') }
    authToken = t
    authLogin = v.login || null
    authState = 'token'
    return { ok: true, login: v.login }
  }

  async function logoutRpc() {
    removeJsonFile(authPath())
    authToken = null
    authLogin = null
    authState = 'anon'
    return { ok: true }
  }

  async function configGetRpc() {
    ensureConfig()
    return { ok: true, proxy: configProxy }
  }

  async function configSetRpc(proxy) {
    const p = typeof proxy === 'string' && proxy.trim() ? proxy.trim() : null
    if (p && !/^(https?:|socks5h?:|socks5:)\/\/\S+$/.test(p)) return { ok: false, error: '代理格式应为 http://host:port 或 socks5://host:port' }
    const wr = saveConfig(p)
    if (!wr.ok) return { ok: false, error: '保存配置失败' + (wr.stderr ? '：' + wr.stderr.slice(0, 300) : '') }
    return { ok: true, proxy: p }
  }

  // ── HTTP 路由（Client fetch 通道） ────────────────────────────
  ctx.webServer.register({
    kind: 'prefix',
    path: '/market-api',
    handler: async (req, res) => {
      try {
        const addr = (req.socket && req.socket.remoteAddress) || ''
        if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
          res.statusCode = 403
          res.end('forbidden')
          return
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let args = {}
        if (body) {
          try { args = JSON.parse(body) } catch { args = {} }
        }
        // webServer 前缀路由将原始 req 交给 handler：req.url 为完整路径，
        // 需先剥离注册前缀 /market-api 再分发到各方法。
        let path = (req.url || '/').split('?')[0]
        if (path.indexOf('/market-api') === 0) path = path.slice('/market-api'.length) || '/'
        let result
        if (path === '/search') {
          result = await searchRepos(args.query, !!args.refresh, args.page, undefined)
        } else if (path === '/info') {
          result = validFullName(args.fullName) ? await infoRpc(args.fullName) : { ok: false, error: 'fullName 格式非法，应为 owner/repo' }
        } else if (path === '/install') {
          result = validFullName(args.fullName) ? await installSource(args.fullName, undefined) : { ok: false, error: 'fullName 格式非法，应为 owner/repo' }
        } else if (path === '/install/run') {
          result = await runInstallRpc(args.fullName, args.repoUrl, args.kind, args.pkgPath || args.pkgName, undefined)
        } else if (path === '/auth/login') {
          result = await loginRpc(args.token)
        } else if (path === '/auth/logout') {
          result = await logoutRpc()
        } else if (path === '/config/get') {
          result = await configGetRpc()
        } else if (path === '/config/set') {
          result = await configSetRpc(args.proxy)
        } else if (path === '/manage/list') {
          result = manageListRpc()
        } else if (path === '/manage/check-updates') {
          result = await manageCheckUpdatesRpc(args.names, undefined)
        } else if (path === '/manage/uninstall') {
          result = manageUninstallRpc(args.name)
        } else if (path === '/manage/remove-src') {
          result = manageRemoveSrcRpc(args.name)
        } else {
          res.statusCode = 404
          res.end('not found')
          return
        }
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result))
      } catch (err) {
        try {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
        } catch { /* ignore */ }
      }
    },
  })

  // ── Agent 工具 ────────────────────────────────────────────────
  function textRender(_args, value) {
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
  }
  function safe(fn) {
    return async (args, exec) => {
      try {
        return await fn(args, exec)
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }
  }

  async function runProbe(argv, signal) {
    let exe
    try { exe = await subprocess.resolveExecutable(argv[0]) } catch (err) {
      return { probe: argv[0], error: 'resolveExecutable 失败：' + String((err && err.message) || err) }
    }
    let handle
    try {
      handle = subprocess.spawn({
        argv,
        cwd: tmpdir(),
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 2 * 1024 * 1024 },
          stderr: { maxBytes: 256 * 1024 },
        },
        graceMs: 2000,
        signal,
      })
    } catch (err) {
      return { probe: argv.join(' '), error: 'spawn 失败：' + String((err && err.message) || err) }
    }
    const outcome = await handle.done
    const out = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
    const errOut = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
    return {
      argv: argv.join(' '),
      exe,
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      stdout: out ? out.text.slice(0, 1500) : '(no stdout reader)',
      stdoutTail: out ? out.text.slice(-300) : '',
      stdoutLen: out ? out.text.length : 0,
      lossy: out ? !!out.lossy : false,
      stderr: errOut ? errOut.text.slice(0, 1500) : '(no stderr reader)',
    }
  }

  const toolDefs = [
    {
      name: 'market_search',
      description: '搜索 DSH 插件市场：先在收录列表（awesome-dsh-plugin 等）中匹配，再调用 GitHub 仓库搜索（按 stars 排序，带缓存与限流保护）。只返回 DSH 相关插件：优先限定 topic:dsh-plugin，结果不足时回退宽查询并按 DSH 特征过滤（topics 含 dsh/dsh-plugin/cordis/deepseek-harness，或名称/描述含 dsh/cordis）。返回插件列表：fullName、描述、stars、forks、语言、topics、来源（curated/github），以及 hasMore（配合 page 翻页）。参数 query 留空时浏览全部 DSH 插件（收录列表 + topic:dsh-plugin 全量）。',
      parameters: {
        query: { type: 'string', required: true, description: '搜索关键词，如 "cordis"、"tool"、仓库名或主题词；留空浏览全部 DSH 插件' },
        page: { type: 'integer', description: '页码，从 1 开始，默认 1；hasMore 为 true 时递增' },
        refresh: { type: 'boolean', description: 'true 时绕过缓存强制走 GitHub 实时搜索' },
      },
      output: { schema: { type: 'json' }, render: textRender },
      execute: safe(async (args, exec) => {
        return await searchRepos(args.query, !!args.refresh, args.page, exec.signal)
      }),
    },
    {
      name: 'market_info',
      description: '查看 DSH 插件的仓库详情：描述、stars、forks、license、语言、topics、README 摘要、安装形态（dynamic/bundle/list）、以及 cordis.yml / dsh.config / package.json 等插件清单文件路径。参数 fullName 格式为 owner/repo。',
      parameters: {
        fullName: { type: 'string', required: true, description: 'GitHub 仓库全名，格式 owner/repo，如 deepseek-ai/deepseek-harness' },
      },
      output: { schema: { type: 'json' }, render: textRender },
      execute: safe(async (args, exec) => {
        if (!validFullName(args.fullName)) return { ok: false, error: 'fullName 格式非法，应为 owner/repo' }
        return await infoRpc(args.fullName)
      }),
    },
    {
      name: 'market_install',
      description: '获取 DSH 插件源码（cordis.yml / dsh.config / 插件入口文件等清单文件内容）为安装做准备，并识别安装形态（install.kind：dynamic=可 define/run；bundle=需 npm 包方式安装（含 cordis.patch.yml 皮肤类子目录，用 dsh plugin add <仓库>/<皮肤目录>）；list=收录类仓库）。返回 ok、files（含 path 和 content）、install、treeSummary。拿到源码后按形态执行安装：dynamic → cordis_define + cordis_run；bundle → 提示用 dsh plugin add。若 GUI 已点击过安装按钮，源码已在缓存中会立即返回（staged: true）。',
      parameters: {
        fullName: { type: 'string', required: true, description: 'GitHub 仓库全名，格式 owner/repo，如 Noob-stupid/dsh-plugin-hub' },
      },
      output: { schema: { type: 'json' }, render: textRender },
      execute: safe(async (args, exec) => {
        if (!validFullName(args.fullName)) return { ok: false, error: 'fullName 格式非法，应为 owner/repo' }
        return await installSource(args.fullName, exec.signal)
      }),
    },
    {
      name: 'market_debug',
      description: '诊断插件市场的网络通道与运行环境：探测 curl、GitHub 端点、认证/代理状态。返回完整 exit/stdout/stderr 供排查。',
      parameters: {},
      output: { schema: { type: 'json' }, render: textRender },
      execute: safe(async (args, exec) => {
        ensureAuth()
        ensureConfig()
        const probes = []
        probes.push(await runProbe(['curl', '--version'], exec.signal))
        probes.push(await runProbe(['curl', '-sS', '--connect-timeout', '8', '--max-time', '20', '-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', 'https://api.github.com/rate_limit'], exec.signal))
        const searchUrl = API + '/search/repositories?' + ['q=' + encodeURIComponent('dsh topic:dsh-plugin'), 'sort=stars', 'order=desc', 'per_page=20'].join('&')
        probes.push(await runProbe(['curl', '-sS', '--connect-timeout', '8', '--max-time', '25', '-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', searchUrl], exec.signal))
        probes.push(await runProbe(['curl', '-sS', '--connect-timeout', '8', '--max-time', '20', '-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', 'https://api.github.com/repos/Noob-stupid/dsh-plugin-hub'], exec.signal))
        probes.push(await runCurl(['-A', UA, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', 'https://api.github.com/repos/Noob-stupid/dsh-plugin-hub'], exec.signal, { timeoutMs: 20 }))
        return { ok: true, auth: { state: authState, login: authLogin }, proxy: configProxy, probes }
      }),
    },
  ]

  for (const t of toolDefs) {
    ctx.tools.register(defineTool(t))
  }

  console.log('dsh-plugin-market: 已就绪（收录 ' + CURATED.length + ' 个仓库，工具 market_search / market_info / market_install / market_debug，路由 /market-api）')
}
