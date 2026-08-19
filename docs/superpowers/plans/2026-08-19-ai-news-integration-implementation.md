# AI新闻资讯频道与周报自动化接入实施计划

## 实施原则

- 跨两个独立仓库实施：`personal-workbench` 提供存储、API 和阅读页面，`ai-weekly` 负责生成、推送和调度。
- 先完成工作台接收端，再实现周报推送端，最后注册计划任务。
- 每个任务先补失败测试，再写最小实现使测试通过。
- `ai-weekly` 的 `LocalPublisher` 始终优先，工作台失败不得中断本地闭环。
- 不覆盖 `personal-workbench/src/client/styles/tokens.css` 中已有的用户修改；AI 新闻样式放入独立样式文件。
- Secret 只从环境变量读取，不写入仓库、日志或测试快照。

## Task 1：定义工作台共享契约与数据库结构

**仓库：** `personal-workbench`

**新增文件：**

- `src/shared/ai-news-contracts.ts`
- `migrations/006_ai_news_reports.sql`
- `tests/unit/ai-news-contracts.test.ts`
- `tests/integration/ai-news-repository.test.ts`

**实现步骤：**

1. 在契约测试中构造最小合法周报，验证 `schemaVersion: 1`、`report_id`、周次、日期、统计、章节和热点字段。
2. 增加失败测试：未知版本、路径与正文 ID 不一致、缺失必填字段、非法日期、负数统计、过长字符串。
3. 建立 Zod Schema，并区分写入请求、列表项和完整详情。
4. 新增 `ai_news_reports` 表，以 `report_id` 为主键，建立 `year DESC, week DESC` 索引。
5. 在仓储测试中验证首次写入、重复 upsert、事务回滚、最新一期、倒序列表和按 ID 获取。
6. 新增 `src/server/modules/ai-news/ai-news-repository.ts`，只负责 SQLite 映射与事务。
7. 运行：

```powershell
pnpm test --run tests/unit/ai-news-contracts.test.ts tests/integration/ai-news-repository.test.ts
```

**提交检查点：** `feat: add AI news report storage contract`

## Task 2：增加独立的机器写入认证

**仓库：** `personal-workbench`

**修改文件：**

- `src/server/config.ts`
- `src/server/security/local-session.ts`
- `tests/integration/local-security.test.ts`

**实现步骤：**

1. 先增加安全测试：普通浏览器修改接口继续要求同源和 `x-workbench-session`；只有精确匹配 AI 新闻 PUT 路由的请求可使用 Bearer Token；错误 Token、路径和方法必须拒绝。
2. 在服务配置中读取 `WORKBENCH_INTEGRATION_TOKEN`。未配置时机器写入接口保持不可用，读取接口不受影响。
3. 扩展 `LocalSessionOptions`，传入可选的集成 Token。
4. 在全局安全 Hook 中使用精确路由模式和常量时间比较判断机器请求；不要给其他路由增加通用豁免。
5. 保持现有安全 Header、JSON Content-Type 和跨域规则不变。
6. 运行：

```powershell
pnpm test --run tests/integration/local-security.test.ts
```

**提交检查点：** `feat: secure AI news machine ingestion`

## Task 3：实现工作台 AI 新闻服务与 API

**仓库：** `personal-workbench`

**新增文件：**

- `src/server/modules/ai-news/ai-news-service.ts`
- `src/server/modules/ai-news/ai-news-routes.ts`
- `tests/integration/ai-news-routes.test.ts`

**修改文件：**

- `src/server/app.ts`
- `src/server/main.ts`

**实现步骤：**

1. 先写路由测试覆盖 PUT 首次写入和重复覆盖、ID 不一致、未知版本、列表、最新一期、单期详情和空状态。
2. 服务层负责跨字段校验、upsert 用例和读取用例；仓储层不解析 HTTP。
3. 写入成功响应 `{ reportId, status: "published", importedAt }`。
4. 在 `buildApp` 中注册 AI 新闻路由，并保持现有可选依赖模式，避免影响旧测试。
5. 在 `main.ts` 创建仓储和服务实例，并从配置向 `LocalSession` 传入集成 Token。
6. 给 Fastify 设置明确的请求体大小上限；测试超限请求不会写入。
7. 运行：

```powershell
pnpm test --run tests/integration/ai-news-routes.test.ts tests/integration/local-security.test.ts
pnpm typecheck
```

**提交检查点：** `feat: expose AI news report API`

## Task 4：实现“AI新闻资讯”阅读页面

**仓库：** `personal-workbench`

**新增文件：**

- `src/client/api/ai-news-client.ts`
- `src/client/pages/ai-news-page.tsx`
- `src/client/features/ai-news/weekly-report-reader.tsx`
- `src/client/styles/ai-news.css`
- `tests/component/ai-news-page.test.tsx`

**修改文件：**

- `src/client/app.tsx`
- `src/client/main.tsx`
- `src/client/layouts/workbench-layout.tsx`

**实现步骤：**

1. 先写组件测试覆盖加载、空、错误、正常、超过 8 天未更新和周次切换。
2. 客户端 API 增加列表、最新一期和单期详情函数，所有响应经过共享 Zod Schema 校验。
3. 在导航中添加“AI新闻资讯”，路由为 `/ai-news`，页面使用 lazy loading。
4. 页面默认请求最新一期，并使用当前 QueryClient 的 15 秒 `staleTime`。
5. “刷新数据”调用 `query.refetch()`，不调用进程或调度接口。
6. 阅读器实现本周判断、核心热点、产品动态、工具与开源、商业机会、趋势信号和下周观察。
7. 热点按真实字段渲染；可选字段为空时整块省略。
8. 外部原文使用安全的新窗口链接属性，不在服务端补抓页面。
9. 使用独立 `ai-news.css` 复现已确认设计，并在 `main.tsx` 中导入；不要修改或格式化用户已有变更的 `tokens.css`。
10. 窄屏将目录改为水平章节导航，洞察双列改为单列。
11. 运行：

```powershell
pnpm test --run tests/component/ai-news-page.test.tsx
pnpm typecheck
pnpm build
```

**提交检查点：** `feat: add AI news weekly reader`

## Task 5：实现 `WorkspacePublisher` 推送协议

**仓库：** `ai-weekly`

**修改文件：**

- `src/ai_weekly/publishers.py`
- `tests/test_reporting_publishing_storage.py`
- 必要时修改 `src/ai_weekly/config.py`

**实现步骤：**

1. 用可注入的 HTTP opener 或 transport 编写失败测试，避免测试访问真实网络。
2. 覆盖未配置、正确 PUT 路径与 Header、版本化正文、200 成功、认证失败、422、5xx、超时、连接失败、非 JSON 和响应 ID 不一致。
3. 使用 Python 标准库 HTTP 客户端，避免为单次本机请求增加新依赖。
4. API 基址由 `WORKSPACE_API_URL` 提供，Publisher 负责追加固定集成路径。
5. 请求超时复用 `request_timeout_seconds`，不无限等待。
6. 保持 Pipeline 顺序不变：LocalPublisher 成功后才尝试 WorkspacePublisher，之后强制重写本地 JSON 状态。
7. 错误信息不得包含 Token 或完整响应正文。
8. 更新旧的“协议尚未定义”测试为真实协议测试。
9. 运行：

```powershell
python -m pytest
```

**提交检查点：** `feat: publish weekly reports to personal workbench`

## Task 6：增加每周一 09:00 的 Windows 调度脚本

**仓库：** `ai-weekly`

**新增文件：**

- `scripts/install-weekly-task.ps1`
- `scripts/uninstall-weekly-task.ps1`

**修改文件：**

- `README.md`

**实现步骤：**

1. 安装脚本接受可覆盖的任务名和运行时间；默认任务名为 `Isabella-AI-Weekly`，星期一 09:00。
2. 任务动作调用绝对路径的 `scripts/run.ps1`，工作目录为项目根目录，PowerShell 使用非交互模式。
3. 重复运行安装脚本时更新同名任务，不创建副本。
4. 卸载脚本只删除精确同名任务，不使用通配符。
5. 安装脚本只注册任务，不立即运行采集。
6. README 补充环境变量、安装、查询、手工运行和卸载说明；不记录真实 Token。
7. 用 PowerShell 解析器检查两个脚本语法。
8. 注册后执行只读验证：

```powershell
Get-ScheduledTask -TaskName 'Isabella-AI-Weekly'
Get-ScheduledTaskInfo -TaskName 'Isabella-AI-Weekly'
```

**提交检查点：** `feat: schedule weekly AI news generation`

## Task 7：跨仓库集成验收

**仓库：** 两个仓库

**实施步骤：**

1. 在工作台测试环境配置临时集成 Token，并启动 API。
2. 在 `ai-weekly` 配置类别、自动发布、工作台 URL 和同一临时 Token。
3. 手工运行 `scripts/run.ps1`，确认本地 JSON、Markdown 和 HTML 生成。
4. 调用工作台读取接口，确认 `report_id`、周次、统计和热点与本地 JSON 一致。
5. 再次发布同一报告，确认列表中只有一条同 ID 记录。
6. 打开工作台页面，检查完整正文、目录、周次选择、外链和同步状态。
7. 停止工作台并再次运行 `ai-weekly`，确认本地输出成功且发布状态为 `failed`。
8. 恢复工作台并重试，确认覆盖为成功状态。
9. 将测试报告导入时间设为超过 8 天，确认页面出现陈旧警告；之后恢复测试数据库。
10. 在 320px、736px 和桌面宽度检查页面无横向溢出或内容裁切。

## Task 8：最终质量检查与交付

**personal-workbench：**

```powershell
pnpm check
git status --short
```

**ai-weekly：**

```powershell
python -m pytest
git status --short
```

**交付检查：**

- 两个仓库均无意外生成文件和 Secret。
- `personal-workbench/src/client/styles/tokens.css` 的既有用户修改仍被保留，且未被本功能提交带入。
- 数据库迁移可在空库和已有库上执行。
- 工作台不运行时，AI Weekly 本地闭环仍能完成。
- 计划任务只存在一个，下一次运行时间为下周一 09:00。
- 最终报告两个仓库的提交、测试结果、计划任务状态和需要保管的环境变量名称。
