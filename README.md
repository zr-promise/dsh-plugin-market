# @dsh-external/dsh-plugin-market

DeepSeek Harness 插件市场（Plugin Marketplace）：在 DSH Web 对话页新增「插件市场」Tab，
浏览、搜索、查看并**一键安装** GitHub 上的 DSH 插件；同时向 Agent 提供
`market_search` / `market_info` / `market_install` / `market_debug` 四个工具。

> 源码：https://github.com/zr-promise/dsh-plugin-market

## 安装

**方式一：命令行（推荐）**

```bash
dsh plugin --profile web add github:zr-promise/dsh-plugin-market
```

**方式二：DSH 插件市场内安装**

1. 打开 DSH Web 对话页 → 顶栏「插件市场」Tab
2. 搜索 `zr-promise/dsh-plugin-market`
3. 点「一键安装」→「源码安装」（或 npm 安装）

安装完成后**重启 DSH**，对话页出现「插件市场」Tab 即生效。

## 功能

- **浏览 / 搜索**：收录列表 + GitHub 仓库搜索（限定 DSH 相关，只返回 DSH 插件），支持分页（加载更多）。
- **手动刷新**：强制重新拉取 GitHub 最新数据（绕过缓存与限流保护）。
- **筛选与排序**：按来源（GitHub / 收录）、语言过滤；按 Stars / Forks / 最近更新 / 名称排序。
- **已安装状态标记**：扫描 `~/.dsh/profiles/*/package.json` 的 bundles 与 `~/.dsh/plugin-src/` 目录，
  在列表与详情页标注「已安装」（60 秒缓存）。
- **详情**：Stars / Forks / License / 默认分支 / Topics / README（内置极简 Markdown 渲染）/ 清单文件。
- **一键安装**：自动识别安装形态——
  - `bundle`：**真·一键安装**——Host 自动 `git clone`（https）到 `~/.dsh/plugin-src/<repo>`、
    写入 profile（bundles + link 依赖）、安装包依赖、创建 node_modules 链接，失败自动回滚，
    重启后生效（支持子目录皮肤与 npm 已发布包的推荐安装）；
  - `dynamic`：动态插件，源码拉取后自动填入对话指令，由助手完成 define + run；
  - `list`：收录/资料类，不可直接安装。
- **GitHub 登录**：粘贴 Personal Access Token（`ghp_…` / `github_pat_…`），验证后持久化到
  `~/.dsh/github-auth.json`，限流从 60 次/小时提升到 5,000 次/小时（搜索 30 次/分钟）。
- **代理**：`~/.dsh/dsh-plugin-market.json` 保存代理配置（`{"proxy": "http://127.0.0.1:7890"}`）。
- **配额显示**：分别展示「搜索配额 / 分」与「API 配额 / 时」两个 GitHub 限流桶。
- **插件管理**（「已装插件」Tab）：列出所有已安装的第三方插件（含仓库名/版本/本地更新时间/
  类型 badge，可点开详情查看 README）；逐个或全部检查更新；两段式确认卸载（含源码删除），
  官方 `@deepseek-ai/*` 不可卸载，重启 DSH 后生效。

## 架构

- **宿主端** `lib/index.js`（ESM，运行在 DSH Node 进程）：
  - 注入 `tools`、`webServer`；
  - `webServer.register({ kind: 'prefix', path: '/market-api', handler })` —— 仅接受 127.0.0.1 / ::1
    环回请求，JSON 分发到 `search` / `info` / `install` / `install/run` / `auth/*` / `config/*` / `manage/*`；
  - 网络通道：`subprocess` + `curl.exe`（`-D -` 响应头解析，支持 `--proxy` 与重定向跟随），
    解析 `x-ratelimit-resource` / `x-ratelimit-remaining` 等限流头；
  - 内存缓存：搜索结果 10 分钟、仓库详情 / 文件树 30 分钟、npm 查询 1 小时；
  - `ctx.tools.register(defineTool(...))` 注册四个 Agent 工具。
- **客户端** `lib/client.js`（Web bundle，`window.__ModuleLoader__.load`）：
  - `require('react')`，`fetch('/market-api/…')` 调用宿主端（同源，无 CORS）；
  - `slots.inject('conversation.view', …)` 注册 Tab（id `dsh-market`，order 12，标签「插件市场」）；
  - 样式随 bundle 注入 `<style>`（不依赖主题 token 之外的任何运行时 API）。

## 数据与限流

- 未登录：core 60 次/小时、search 10 次/分钟；登录后：core 5,000 次/小时、search 30 次/分钟。
- 搜索结果缓存 10 分钟，降低 GitHub 调用量；翻页上限 10 页（GitHub 搜索分页限制）。
- 登录 Token 以明文存放在 `~/.dsh/github-auth.json`（与 DSH 其余配置同目录），请妥善保管。

## 开发与发布

- `lib/index.js` 为宿主端单一文件；`lib/client.js` 为客户端 bundle（无构建步骤，纯手写）。
- 改动后重新安装并重启 DSH 生效。
- 回归测试与 npm 发布步骤见 `PUBLISH.md`。

License: MIT
