# 个人 Codex 工作台实施计划

> 依据规格：`docs/superpowers/specs/2026-08-17-personal-codex-workbench-design.md`
>
> 目标：交付一个仅监听本机的网页工作台，能够真实管理工作台自有任务，并通过 Codex App Server 查看及启停 Skills。

## 1. 实施原则

1. 先验证 Codex 集成能力，再建设业务界面。
2. 每个阶段先写失败测试，再实现最小代码使其通过。
3. 工作台任务和原生 Scheduled Tasks 始终使用不同术语、路由和数据源。
4. 不直接修改 Codex 未公开数据库或私有任务存储。
5. 删除操作默认可恢复；测试不能操作真实系统或插件 Skill。
6. 每个任务完成后运行目标测试、类型检查和格式检查，再单独提交。

## 2. 技术栈

- 运行时：Node.js 24；代码保持 Node.js 20+ 兼容。
- 包管理器：pnpm 11。
- 语言：TypeScript，开启严格模式。
- 前端：React、Vite、React Router、TanStack Query。
- 后端：Fastify、Zod。
- 数据库：SQLite、`better-sqlite3`，使用显式 SQL migration 和轻量 repository。
- 调度：`croner`，所有计算显式传入 IANA 时区。
- Codex 执行：官方 `@openai/codex-sdk`。
- Skill 集成：通过子进程标准输入/输出连接 `codex app-server` JSON-RPC，使用 `skills/list`、`skills/config/write` 和变化通知；第一版不依赖实验性的 WebSocket transport。
- 测试：Vitest、Fastify inject、React Testing Library、Playwright。
- 样式：CSS variables + CSS modules；不引入大型组件库。

本机已确认 Node.js `v24.19.0` 和 Codex 随附的 pnpm `11.19.0` 可用。普通 `npm` 不在 PATH 中；实施时使用已发现的 pnpm，项目本身不硬编码用户机器上的绝对工具路径。

## 3. 目标目录

```text
personal-workbench/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── migrations/
│   └── 001_initial.sql
├── scripts/
│   ├── migrate.ts
│   └── verify-codex-capabilities.ts
├── src/
│   ├── shared/
│   │   ├── contracts.ts
│   │   ├── errors.ts
│   │   └── task-state.ts
│   ├── server/
│   │   ├── app.ts
│   │   ├── main.ts
│   │   ├── config.ts
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   └── migrate.ts
│   │   ├── integrations/codex/
│   │   │   ├── app-server-client.ts
│   │   │   ├── codex-task-executor.ts
│   │   │   └── redact.ts
│   │   ├── modules/tasks/
│   │   │   ├── task-repository.ts
│   │   │   ├── task-service.ts
│   │   │   ├── task-scheduler.ts
│   │   │   └── task-routes.ts
│   │   ├── modules/skills/
│   │   │   ├── skill-origin-repository.ts
│   │   │   ├── skill-service.ts
│   │   │   └── skill-routes.ts
│   │   └── security/
│   │       ├── local-session.ts
│   │       └── path-policy.ts
│   └── client/
│       ├── main.tsx
│       ├── app.tsx
│       ├── api/client.ts
│       ├── styles/tokens.css
│       ├── layouts/workbench-layout.tsx
│       └── pages/
│           ├── dashboard-page.tsx
│           ├── tasks-page.tsx
│           └── skills-page.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── component/
│   ├── e2e/
│   └── fixtures/
└── docs/
```

## 4. 分步实施

### 任务 1：建立最小 TypeScript 工程和质量门槛

**创建文件**

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `vitest.config.ts`
- `playwright.config.ts`
- `src/shared/contracts.ts`
- `tests/unit/smoke.test.ts`

**实施内容**

1. 初始化 pnpm 项目，写入 `packageManager` 字段。
2. 安装 TypeScript、Vitest、ESLint、Prettier、Vite 和基础类型依赖。
3. 配置 `typecheck`、`test`、`test:integration`、`test:e2e`、`lint`、`format:check`、`dev` 和 `build` 脚本。
4. 添加一个失败的 smoke test，再创建最小共享模块使其通过。
5. 确认构建产物、覆盖率和运行数据均被 `.gitignore` 排除。

**验证**

```powershell
pnpm typecheck
pnpm test --run
pnpm lint
pnpm format:check
```

**提交**

`chore: scaffold TypeScript workbench`

### 任务 2：完成 Codex 能力验证关卡

**创建文件**

- `src/server/integrations/codex/app-server-client.ts`
- `src/server/integrations/codex/codex-task-executor.ts`
- `scripts/verify-codex-capabilities.ts`
- `tests/unit/app-server-client.test.ts`
- `tests/integration/codex-capabilities.test.ts`
- `tests/fixtures/skills/workbench-capability-test/SKILL.md`
- `docs/compatibility.md`

**实施内容**

1. 安装官方 `@openai/codex-sdk`。
2. 实现最小 JSON-RPC 客户端：启动 `codex app-server`、完成初始化、关联请求 ID、处理响应、错误和退出。
3. 为 JSON-RPC 编解码、超时和异常退出先写基于假子进程的单元测试。
4. 能力脚本调用 `skills/list`，打印数量和安全的元数据摘要，不打印完整 Skill 内容。
5. 通过当前协议的 `skills/extraRoots/set` 让 App Server 发现仓库内的专用 fixture Skill。真实用户环境只做只读列举；`skills/config/write` 启停测试在临时 `CODEX_HOME` 中执行，测试先记录原状态，并在 `finally` 中恢复。恢复失败时能力验证必须失败并给出人工恢复命令。
6. 使用 Codex SDK 执行一个无网络、无文件写入的提示，验证能够取得最终响应和线程标识。
7. 将 Windows、Codex 版本、认证方式、实际可用方法和已知限制写入 `docs/compatibility.md`。

**验证**

```powershell
pnpm test --run tests/unit/app-server-client.test.ts
pnpm verify:codex
pnpm test:integration --run tests/integration/codex-capabilities.test.ts
```

运行真实 Codex 进程可能需要用户批准在沙箱外执行。此任务未通过前，不进入任务引擎或 Skill 写操作开发。

**提交**

`test: verify local Codex integration capabilities`

### 任务 3：定义共享契约与任务状态机

**创建文件**

- `src/shared/task-state.ts`
- `src/shared/errors.ts`
- `tests/unit/task-state.test.ts`
- `tests/unit/contracts.test.ts`

**修改文件**

- `src/shared/contracts.ts`

**实施内容**

1. 定义任务、任务运行、Skill 摘要、分页结果和 API 错误的 Zod schema。
2. 定义 `pending`、`running`、`succeeded`、`failed`、`cancelled`、`missed` 状态及合法转换。
3. 为非法转换、重复终态和时间字段一致性写测试。
4. 服务端和前端都从共享 schema 推导类型，禁止复制接口类型。

**验证**

```powershell
pnpm test --run tests/unit/task-state.test.ts tests/unit/contracts.test.ts
pnpm typecheck
```

**提交**

`feat: define task and skill contracts`

### 任务 4：建立 SQLite schema、migration 和 repository

**创建文件**

- `migrations/001_initial.sql`
- `scripts/migrate.ts`
- `src/server/db/connection.ts`
- `src/server/db/migrate.ts`
- `src/server/modules/tasks/task-repository.ts`
- `src/server/modules/skills/skill-origin-repository.ts`
- `tests/integration/database.test.ts`
- `tests/integration/task-repository.test.ts`

**实施内容**

1. 创建 `tasks`、`task_runs`、`skill_origin_overrides`、`settings` 和 migration 记录表。
2. 为任务软删除、运行唯一键、状态查询和时间查询建立索引。
3. repository 接口不暴露 SQLite 特有对象。
4. 使用事务原子完成“领取任务 + 创建运行记录”。
5. 使用临时数据库测试 migration 可重复执行、唯一约束、软删除恢复和事务回滚。

**验证**

```powershell
pnpm test:integration --run tests/integration/database.test.ts tests/integration/task-repository.test.ts
pnpm typecheck
```

**提交**

`feat: add task persistence and migrations`

### 任务 5：实现调度器和单任务锁

**创建文件**

- `src/server/modules/tasks/task-scheduler.ts`
- `tests/unit/task-scheduler.test.ts`
- `tests/integration/task-scheduler-recovery.test.ts`

**实施内容**

1. 封装系统时钟，测试使用假时钟推进。
2. 使用 cron 表达式和 IANA 时区计算下一次运行。
3. 同一时间只领取一个任务；同一任务不能出现两个活动运行。
4. 服务启动时把失去执行进程的 `running` 记录转为 `failed/service_interrupted`。
5. 对关机期间的过期计划创建 `missed` 记录，不自动补跑；每个任务每次恢复最多生成一条汇总记录，避免长期离线后批量膨胀。
6. 停止服务时先停止领取新任务，再等待当前任务完成或记录取消。

**验证**

```powershell
pnpm test --run tests/unit/task-scheduler.test.ts
pnpm test:integration --run tests/integration/task-scheduler-recovery.test.ts
```

**提交**

`feat: add durable local task scheduler`

### 任务 6：实现 Codex 任务执行与日志脱敏

**创建文件**

- `src/server/integrations/codex/redact.ts`
- `tests/unit/redact.test.ts`
- `tests/integration/codex-task-executor.test.ts`

**修改文件**

- `src/server/integrations/codex/codex-task-executor.ts`
- `src/server/modules/tasks/task-scheduler.ts`

**实施内容**

1. 把任务请求转换为 Codex SDK thread run。
2. 记录线程 ID、开始和结束时间、最终响应、失败类别和日志路径。
3. 在持久化和返回浏览器前遮蔽常见 API key、Bearer token 和敏感环境变量值。
4. 对超时、取消、认证失败和进程异常使用不同错误码。
5. 默认不重试；人工重新运行创建新的运行 ID，并引用原失败运行。

**验证**

```powershell
pnpm test --run tests/unit/redact.test.ts
pnpm test:integration --run tests/integration/codex-task-executor.test.ts
```

**提交**

`feat: execute workbench tasks through Codex SDK`

### 任务 7：实现任务服务和 HTTP API

**创建文件**

- `src/server/modules/tasks/task-service.ts`
- `src/server/modules/tasks/task-routes.ts`
- `src/server/app.ts`
- `src/server/main.ts`
- `src/server/config.ts`
- `tests/integration/task-routes.test.ts`

**实施内容**

1. 提供任务列表、详情、创建、修改、启停、立即运行、运行历史、软删除和恢复接口。
2. 所有输入由共享 Zod schema 校验。
3. 立即运行使用服务端幂等键和 repository 唯一约束。
4. 删除默认只设置 `deleted_at`；恢复前检查名称和计划冲突。
5. 分页加载历史记录；完整日志通过受限文件读取接口返回。

**建议路由**

```text
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
POST   /api/tasks/:id/enable
POST   /api/tasks/:id/pause
POST   /api/tasks/:id/run
GET    /api/tasks/:id/runs
GET    /api/runs/:runId
DELETE /api/tasks/:id
POST   /api/tasks/:id/restore
```

**验证**

```powershell
pnpm test:integration --run tests/integration/task-routes.test.ts
pnpm typecheck
```

**提交**

`feat: expose task management API`

### 任务 8：实现 Skill 服务、来源分类和安全删除

**创建文件**

- `src/server/modules/skills/skill-service.ts`
- `src/server/modules/skills/skill-routes.ts`
- `src/server/security/path-policy.ts`
- `tests/unit/skill-origin.test.ts`
- `tests/unit/path-policy.test.ts`
- `tests/integration/skill-routes.test.ts`

**实施内容**

1. 通过 App Server 获取实时清单，并保存最近一次成功缓存。
2. 按“系统 → 插件 → 自建记录 → 安装记录 → 待确认”顺序分类。
3. 启停调用 `skills/config/write`，随后强制刷新确认最终状态。
4. App Server 下线时返回带 `stale: true` 的只读缓存，写接口返回明确的不可用错误。
5. 查看内容和打开目录前校验 Skill 路径必须来自 App Server 当前清单。
6. 删除只允许用户或自建范围：先停用，再调用 Windows 回收站适配器；系统、插件和不明来源均拒绝删除。
7. 对打开目录和回收站操作分别封装接口，单元测试使用假实现，不能在自动测试中移动真实 Skill。

**建议路由**

```text
GET    /api/skills
GET    /api/skills/:skillId
POST   /api/skills/:skillId/enable
POST   /api/skills/:skillId/disable
PATCH  /api/skills/:skillId/origin
POST   /api/skills/:skillId/open-folder
DELETE /api/skills/:skillId
```

`skillId` 是服务端针对当前可发现清单生成的稳定不透明标识。客户端不能提交绝对路径；服务端只从自己的当前清单或受信缓存中解析标识到规范路径。

**验证**

```powershell
pnpm test --run tests/unit/skill-origin.test.ts tests/unit/path-policy.test.ts
pnpm test:integration --run tests/integration/skill-routes.test.ts
```

**提交**

`feat: add safe Codex skill management`

### 任务 9：增加本机会话与服务安全边界

**创建文件**

- `src/server/security/local-session.ts`
- `tests/integration/local-security.test.ts`

**修改文件**

- `src/server/app.ts`
- `src/server/config.ts`
- `src/server/main.ts`

**实施内容**

1. 默认绑定 `127.0.0.1`，配置为非回环地址时拒绝启动。
2. 启动时生成随机会话令牌，通过同源页面获取并用于修改请求。
3. 对修改接口校验 `Origin`、会话令牌和 JSON content type。
4. 设置严格 CSP、禁止 iframe、禁止 MIME 猜测。
5. 错误响应使用稳定错误码，不返回堆栈、环境变量或绝对敏感路径。

**验证**

```powershell
pnpm test:integration --run tests/integration/local-security.test.ts
```

**提交**

`feat: secure the localhost control plane`

### 任务 10：实现前端壳、设计令牌和首页

**创建文件**

- `src/client/main.tsx`
- `src/client/app.tsx`
- `src/client/api/client.ts`
- `src/client/styles/tokens.css`
- `src/client/layouts/workbench-layout.tsx`
- `src/client/pages/dashboard-page.tsx`
- `src/server/modules/dashboard/dashboard-service.ts`
- `src/server/modules/dashboard/dashboard-routes.ts`
- `tests/component/dashboard-page.test.tsx`
- `tests/integration/dashboard-routes.test.ts`

**实施内容**

1. 建立固定侧边栏和主内容区，预留未启用模块但清楚显示“后续版本”。
2. 增加 `GET /api/dashboard` 聚合接口，首页读取任务统计、最近运行和 Skill 统计，不下载完整日志或完整 Skill 清单来计算数字。
3. 对加载、空数据、只读缓存和服务错误分别设计状态。
4. 使用语义化 HTML、键盘焦点和可读颜色对比。
5. 不制作无数据来源的装饰性图表。

**验证**

```powershell
pnpm test --run tests/component/dashboard-page.test.tsx
pnpm build
```

**提交**

`feat: build workbench shell and dashboard`

### 任务 11：实现任务日志页面

**创建文件**

- `src/client/pages/tasks-page.tsx`
- `src/client/features/tasks/task-list.tsx`
- `src/client/features/tasks/run-detail.tsx`
- `src/client/features/tasks/task-form.tsx`
- `tests/component/tasks-page.test.tsx`

**实施内容**

1. 完成状态筛选、搜索、任务列表和结果详情同屏布局。
2. 完成创建、修改、启停、立即运行、重新运行、软删除和恢复交互。
3. 操作进行中禁用重复点击；服务端冲突仍需正确展示。
4. 失败结果显示可读原因、耗时和完整日志入口。
5. 删除对话框明确说明 30 天恢复期。

**验证**

```powershell
pnpm test --run tests/component/tasks-page.test.tsx
pnpm build
```

**提交**

`feat: build task log experience`

### 任务 12：实现 Skill 管理页面

**创建文件**

- `src/client/pages/skills-page.tsx`
- `src/client/features/skills/skill-list.tsx`
- `src/client/features/skills/skill-detail.tsx`
- `tests/component/skills-page.test.tsx`

**实施内容**

1. 完成来源筛选、搜索、清单和详情同屏布局。
2. 显示实时或缓存状态，缓存模式禁用所有写操作。
3. 完成查看说明、打开目录、启停和人工来源标记。
4. 只有服务端返回 `deletable: true` 时显示删除按钮；前端判断不能替代服务端授权。
5. 删除对话框明确说明“先停用，再移入系统回收站”。

**验证**

```powershell
pnpm test --run tests/component/skills-page.test.tsx
pnpm build
```

**提交**

`feat: build skill management experience`

### 任务 13：端到端验收与恢复测试

**创建文件**

- `tests/e2e/task-lifecycle.spec.ts`
- `tests/e2e/skill-management.spec.ts`
- `tests/e2e/degraded-mode.spec.ts`
- `tests/fixtures/fake-codex.ts`

**实施内容**

1. 默认 E2E 使用假 Codex 适配器，确保测试可重复且不会修改真实环境。
2. 覆盖任务创建、运行、失败、暂停、恢复、删除和恢复。
3. 覆盖重复立即运行只产生一个实例。
4. 覆盖 Skill 实时列表、启停、系统保护和缓存只读模式。
5. 增加一组手动真实环境验收脚本，只操作专用测试任务和测试 Skill。

**验证**

```powershell
pnpm test --run
pnpm test:integration --run
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

**提交**

`test: cover workbench acceptance flows`

### 任务 14：本机启动、数据维护和交付文档

**创建文件**

- `README.md`
- `docs/operations.md`
- `scripts/start-local.ps1`
- `scripts/cleanup-retention.ts`
- `tests/integration/retention.test.ts`

**实施内容**

1. 提供一个 PowerShell 启动脚本，解析项目目录、运行 migration、启动本地服务并打开浏览器。
2. 启动脚本使用隐藏后台窗口；找不到依赖时给出明确安装提示。
3. 实现 90 天运行日志和 30 天软删除任务的清理流程；默认只在应用启动后低频执行。
4. README 说明安装、首次启动、数据目录、备份、恢复和停止方式。
5. 运维文档说明 App Server/SDK 故障、认证失效、数据库备份和安全限制。
6. 按设计规格逐项执行十条验收标准并记录结果。

**验证**

```powershell
pnpm test:integration --run tests/integration/retention.test.ts
pnpm check
```

**提交**

`docs: add local operations and release checklist`

## 5. 里程碑与停止条件

### 里程碑 A：集成可行

任务 1–2 完成。必须真实验证 Skill 列表、测试 Skill 启停以及 Codex SDK 无副作用运行。任一关键能力失败时暂停后续开发，修订设计或降级范围。

### 里程碑 B：后端闭环

任务 3–9 完成。任务生命周期、调度恢复、Skill 管理、缓存降级和安全边界通过集成测试。

### 里程碑 C：用户可用

任务 10–12 完成。三个已确认页面可以使用，交互与后端状态一致。

### 里程碑 D：可交付

任务 13–14 完成。自动测试、真实环境验收、启动脚本和运维文档全部通过。

## 6. 计划风险与处理

1. **Codex 可执行文件受沙箱限制**：真实能力验证需要用户批准在沙箱外运行，不能通过复制或修改安装目录规避。
2. **App Server 协议变化**：适配器隔离 JSON-RPC 细节，并在 `docs/compatibility.md` 固定已验证版本和能力。
3. **SDK 认证方式与桌面登录不一致**：能力验证阶段确认；失败时停止任务引擎开发，不擅自要求用户提供或存储密钥。
4. **SQLite 原生依赖安装失败**：先验证 `better-sqlite3` 在当前 Node 版本有可用构建；失败时改用兼容 SQLite 驱动，repository 接口保持不变。
5. **任务产生外部副作用**：默认不重试，测试使用假执行器，真实验收只使用无副作用提示。
6. **Skill 来源无法完全自动识别**：未知项保持“待确认”，不自动归入可删除分类。

## 7. 官方依据

- Codex SDK：https://developers.openai.com/codex/sdk
- Codex App Server：https://developers.openai.com/codex/app-server
- Build Skills：https://learn.chatgpt.com/docs/build-skills
- Scheduled Tasks：https://learn.chatgpt.com/docs/automations
