# Personal Workbench

Personal Workbench 是一个仅监听本机回环地址的个人助理工作台。当前版本聚焦两个核心模块：任务日志和 Skill 管理。

## 启动

在 PowerShell 中执行：

```powershell
cd D:\AI-Codex-Projects\personal-workbench
.\scripts\start-local.ps1
```

浏览器地址：<http://127.0.0.1:5173/>。

手动启动时可以分别执行 `pnpm start:server` 和 `pnpm dev -- --port 5173`。首次启动会自动执行数据库迁移。停止后台进程可在任务管理器中结束本次启动的 `node` 进程，或使用前台命令并按 `Ctrl+C`。

## 当前能力

- 任务日志：创建、编辑、启停、立即运行、失败重试、运行结果与完整日志、软删除和恢复。
- Skill 管理：列出实际可发现的 Skill，区分系统/插件/已安装/自己生成等来源，启停、打开目录；可删除项会先禁用，再将整个目录移入 Windows 回收站。
- 首页：查看任务和 Skill 汇总、最近运行记录以及 Skill 缓存是否过期。

工作台自己的定时任务由本地调度器负责，并通过 Codex SDK 执行。它不会假装接管 Codex 原生 Scheduled Tasks。

## 数据与维护

- SQLite：`data/workbench.sqlite`（同时会产生 WAL 文件）。
- 任务完整日志：`logs/`。
- Skill 来源覆盖与缓存：保存在 SQLite 中。
- 手动执行保留清理：`pnpm cleanup`。服务启动后也会执行一次，并每 6 小时低频检查一次。
- 默认保留任务运行记录 90 天；软删除任务保留 30 天后清理。清理只删除明确符合期限的数据。

## 安全边界

服务只接受 `127.0.0.1`、`localhost` 或 `::1`。写请求需要启动时生成的本机会话令牌与正确 Origin；不要把 API 端口转发到公网。API 默认端口为 4310，前端开发服务器为 5173。

## 验证

```powershell
pnpm check
pnpm test:integration
pnpm cleanup
```

当前自动化检查覆盖数据库、任务调度、API、组件和安全边界；真实 Codex 能力验证仍通过 `pnpm verify:codex` 手动执行，且不会修改真实 Skill 配置。
