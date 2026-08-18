# @dsh-external/dsh-plugin-market

DeepSeek Harness 插件市场（Plugin Marketplace）。

在 DSH Web 对话页新增「插件市场」Tab，用来浏览、搜索、查看并安装 GitHub 上的 DSH 插件；同时提供「插件管理」Tab，用来检查更新、一键更新、查看详情和卸载已安装插件。插件同时向 Agent 暴露 `market_search` / `market_info` / `market_install` / `market_debug` 四个工具。

> 源码：<https://github.com/zr-promise/dsh-plugin-market>

---

## 安装

以下两种方式任选其一。安装完成后**重启 DSH**，对话页出现「插件市场」Tab 即表示安装成功。

### 方式一：命令行

```bash
dsh plugin --profile web add github:zr-promise/dsh-plugin-market
```

### 方式二：发给 DSH 助手

在 DSH 对话页输入框粘贴上面的命令，助手会代为执行安装，无需自己操作终端。

### 安装之后

- 市场的主要用途是搜索并安装**其他** DSH 插件。
- 想更新或重装本插件，在市场内搜索 `zr-promise/dsh-plugin-market` 一键安装即可。
- 未来发布到 npm 后，也可用 `dsh plugin --profile web add @zr-promise/dsh-plugin-market` 安装。

---

## 功能

### 插件市场 Tab

- **浏览与搜索**：内置收录列表 + GitHub 仓库搜索，只返回 DSH 相关插件；支持「加载更多」分页。
- **首页收录优化**：除了 `topic:dsh-plugin`，还会合并 `dsh in:name` 高星仓库，避免“没打 topic 但确实是 DSH 插件”的项目漏掉。
- **手动刷新**：点击强制拉取 GitHub 最新数据，绕过缓存与限流保护。
- **筛选与排序**：按来源（GitHub / 收录）、语言过滤；按 Stars / Forks / 最近更新 / 名称排序。
- **已安装标记**：扫描本机 `~/.dsh/profiles/*/package.json` 的 bundles 与 `~/.dsh/plugin-src/` 目录，在列表和详情页标注「已安装」（60 秒缓存）。
- **插件详情**：Stars / Forks / License / 默认分支 / Topics / README（内置极简 Markdown 渲染）与插件清单文件。
- **一键安装**：自动识别安装形态——
  - `bundle`：真·一键安装。Host 自动 `git clone` 到 `~/.dsh/plugin-src/<repo>`，写入 profile（bundles + link 依赖）、安装包依赖并创建 node_modules 链接，失败自动回滚，重启后生效；支持子目录皮肤和 npm 已发布包的推荐安装。
  - `dynamic`：动态插件。拉取源码后自动填入对话指令，由助手完成 define + run。
  - `list`：收录 / 资料类仓库，不可直接安装。

### 插件管理 Tab

- 列出所有已安装的第三方插件，显示仓库名 / 版本 / 本地更新时间 / 类型 / 套装信息。
- **详情页**：展示本地路径、关联组件/预设、GitHub 信息、README 与清单文件。
- **检查更新**：逐个或全部检查。优先比较版本号，版本一致不会误报；本地缺少仓库信息时，会回退查询 npm registry 的 repository 元数据；仍无法比较版本时才按仓库推送时间做启发式判断。
- **一键更新**：检测到新版本时显示「更新」按钮。git 源码安装走 `git fetch + reset`（无 `.git` 且目录独立则重新 clone）；npm 安装走 `pnpm add <name>@<最新版>`（显式指定版本，避免 pnpm v11 的 minimumReleaseAge 静默装到旧版）。更新前自动备份，失败自动回滚；更新后自动重装依赖并做入口预检，重启 DSH 生效。
- **卸载**：两段式确认卸载，连同源码目录删除。官方 `@deepseek-ai/*` 插件不可卸载。
- **套装卸载**：如果插件属于某个套装（如 `dsh-routing-suite`），卸载时会连带删除关联的源码目录和 agent preset，并在界面明确展示“关联组件/预设”。

### 其他

- **GitHub 登录**：粘贴 Personal Access Token（`ghp_…` / `github_pat_…`），验证通过后保存到 `~/.dsh/github-auth.json`，API 限额从 60 次/小时提升到 5,000 次/小时（搜索 30 次/分钟）。
- **代理**：可在 `~/.dsh/dsh-plugin-market.json` 配置代理（`{"proxy": "http://127.0.0.1:7890"}`）。
- **配额显示**：分别展示「搜索配额 / 分钟」与「API 配额 / 小时」两个 GitHub 限流桶。

---

## Agent 工具

| 工具 | 说明 |
|---|---|
| `market_search` | 搜索/浏览 DSH 插件，支持分页、刷新 |
| `market_info` | 查看仓库详情、README、清单文件与安装形态 |
| `market_install` | 获取插件源码并识别安装形态（dynamic / bundle / list） |
| `market_debug` | 诊断 curl、GitHub 网络、认证与代理状态 |

---

## 套装清单约定

第三方“套装/预设”类安装可以在 `~/.dsh/dsh-suite-manifests/*.json` 写入清单，让市场自动识别为“套装”，并支持整体卸载与仓库信息补全：

```json
{
  "id": "my-suite",
  "label": "My Suite",
  "plugins": ["@scope/my-plugin"],
  "repos": {
    "@scope/my-plugin": "owner/my-repo"
  },
  "components": [
    { "label": "my-plugin 源码", "path": "C:/Users/you/.dsh/my-plugin-src" },
    { "label": "my-preset 预设", "path": "C:/Users/you/.dsh/.agent-presets/my-preset" }
  ]
}
```

- `plugins`：该套装包含的 bundle 插件名。
- `repos`：可选，给本地缺少 repository 元数据的插件补全 GitHub 仓库名，用于“检查更新”。
- `components`：卸载时需要一并删除的目录/预设，会显示在插件管理详情中。

---

## 架构

- **宿主端** `lib/index.js`（ESM，运行在 DSH Node 进程）
  - 注入 `tools` 与 `webServer`。
  - 通过 `webServer.register({ kind: 'prefix', path: '/market-api', handler })` 暴露 API，仅接受 `127.0.0.1` / `::1` 环回请求。
  - 网络通道使用 `subprocess` + `curl.exe`，支持 `--proxy`、重定向跟随，并解析 GitHub 限流头。
  - 内存缓存：搜索结果 10 分钟、仓库详情/文件树 30 分钟、npm 查询 1 小时。
- **客户端** `lib/client.js`（Web bundle）
  - 经 `window.__ModuleLoader__.load` 加载，使用 `require('react')`。
  - 通过 `fetch('/market-api/…')` 同源调用宿主端。
  - 通过 `slots.inject('conversation.view', …)` 注册「插件市场」Tab（id `dsh-market`，order 12）。
  - 样式随 bundle 注入 `<style>`，只依赖主题 token，不依赖额外运行时 API。

---

## API 端点

前缀：`/market-api`（仅本机环回）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/search` | 搜索/浏览插件 |
| POST | `/info` | 仓库详情 + README + 清单 + 安装形态 |
| POST | `/install` | 获取安装源码并识别形态 |
| POST | `/install/run` | 真·一键安装（clone + 写 profile + 依赖同步） |
| POST | `/auth/login` | 登录 GitHub |
| POST | `/auth/logout` | 注销 |
| POST | `/config/get` | 读取代理配置 |
| POST | `/config/set` | 保存代理配置 |
| POST | `/manage/list` | 已安装第三方插件列表 |
| POST | `/manage/check-updates` | 检查更新 |
| POST | `/manage/update` | 一键更新到最新版 |
| POST | `/manage/uninstall` | 卸载插件（含源码/套装组件） |
| POST | `/manage/remove-src` | 删除未引用的源码残留目录 |

---

## 数据与限额

- 未登录：core 60 次/小时、search 10 次/分钟。
- 登录后：core 5,000 次/小时、search 30 次/分钟。
- 搜索结果缓存 10 分钟；翻页上限 10 页。
- 登录 Token 以明文存放在 `~/.dsh/github-auth.json`，请妥善保管。

---

## 开发与测试

- `lib/index.js` 为宿主端单一文件，`lib/client.js` 为客户端 bundle（无构建步骤，纯手写）。
- 修改后同步到 `C:\Users\<user>\.dsh\plugin-src\dsh-plugin-market\`，热重载或重启 DSH 生效。
- 回归测试见 `scripts/`：`smoke-host.mjs`、`smoke-client-render.mjs`、`uninstall-test.mjs`、`install-run-test.mjs`、`edge-test.mjs`、`scan-repos.mjs`。
- 发布与打包步骤见 `PUBLISH.md`。

---

License: MIT
