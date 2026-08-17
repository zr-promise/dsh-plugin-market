# 发布指南：把 dsh-plugin-market 发布到 GitHub

本目录（`plugin-package/`）就是一个完整的 npm 格式 dsh 插件包，可直接作为 GitHub 仓库根目录发布。

## 1. 发布到 GitHub（源码分发，推荐先做）

```powershell
# 在 plugin-package 目录内
cd "E:\dsh workspace collect\插件市场\plugin-package"

git init
git add -A
git commit -m "dsh-plugin-market: 插件市场（浏览/搜索/详情/一键安装/插件管理）"
```

然后在 GitHub 网页创建新仓库（**不要**勾选 README/LICENSE/gitignore——本包已自带），仓库名建议 `dsh-plugin-market`，然后：

```powershell
git remote add origin https://github.com/<你的用户名>/dsh-plugin-market.git
git branch -M main
git push -u origin main
```

### 提升市场可见性（重要）

1. 在 GitHub 仓库 **Settings → Topics** 添加：`dsh-plugin`、`dsh`、`deepseek-harness`、`cordis`
   —— 这样 `topic:dsh-plugin` 搜索能命中，市场里就能搜到它。
2. 想进官方收录列表（`beancookie/awesome-dsh-plugin`）可以提 PR。

### 别人如何安装你的插件

- 源码安装：市场搜索到后「一键安装」（自动 clone 到 plugin-src + 写 profile）
- 或命令行：`dsh plugin --profile web add github:<你的用户名>/dsh-plugin-market`

## 2. 发布到 npm（可选，官方推荐路径）

> 当前包名 `@dsh-external/dsh-plugin-market` 的 scope 是**假的**（本机示例用），npm 发布会失败。
> 需要先改包名：

```jsonc
// package.json
{
  "name": "dsh-plugin-market",          // 方案 A：非 scope 名（需全局唯一）
  // 或 "name": "@你的npm用户名/dsh-plugin-market"   // 方案 B：你的真实 npm scope
}
```

然后：

```powershell
npm login          # 需要 npm 账号（https://www.npmjs.com/signup）
npm publish
```

发布后别人可 `dsh plugin --profile web add dsh-plugin-market` 直接 npm 安装（市场检测到 npm 归属后也会推荐「npm 安装」按钮）。

> 注意：README 的徽章/链接、版本号（`version` 字段）发布前更新一下；每次发布要递增版本号。

## 3. 发布前自查清单

- [ ] 包内无真实密钥/token（本包已验证：仅提示文案与运行时路径，无密钥）
- [ ] `.gitignore` 已包含 node_modules（已提供）
- [ ] `README.md` 内容完整（已提供）
- [ ] 想发布 npm 时包名已改且唯一
- [ ] LICENSE：当前为 MIT（package.json 已声明），如需其他许可改 `license` 字段

## 4. 回归验证（发布前建议跑一遍）

```powershell
# 需要隔离环境（含 pkg/index.js 副本），详见 scripts/ 内各测试文件头注释
node scripts/smoke-host.mjs <隔离目录>          # Host 端到端
node scripts/smoke-client-render.mjs            # Client 渲染
node scripts/install-run-test.mjs <隔离目录>    # 一键安装链路
node scripts/edge-test.mjs <隔离目录>           # 边界形态
node scripts/scan-repos.mjs <隔离目录>          # 全仓库形态回归
```
