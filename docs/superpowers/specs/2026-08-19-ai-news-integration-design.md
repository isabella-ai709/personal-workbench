# AI新闻资讯频道与周报自动化接入设计

## 1. 目标

在 Isabella.Y 个人工作台中新增一级类别“AI新闻资讯”，接入 `ai-weekly` 生成的 AI 热点周报。该频道是个人情报台，帮助用户及时了解 AI 前沿动态。

首版只服务单个用户，默认展示最新一期完整周报，不提供协作、评论、分享或订阅功能。

## 2. 已确认决策

- 频道名称：AI新闻资讯。
- 产品定位：个人 AI 前沿情报台。
- 默认内容：最新一期完整周报，而非摘要仪表盘。
- 页面结构：周报阅读器，包含周次选择、自动化状态、报告目录和完整正文。
- 接入方式：`ai-weekly` 生成结束后通过工作台 API 主动推送。
- 运行计划：每周一 09:00，按运行机器的 Asia/Shanghai 本地时间触发。
- 自动化边界：工作台不启动或控制 `ai-weekly` 进程，只接收发布结果。

## 3. 页面设计

### 3.1 工作台导航

在“经验复盘”之后增加一级导航项“AI新闻资讯”。使用 Fluent UI 的资讯或广播类图标，并沿用现有工作台的浅蓝色激活状态、间距和交互规则。

路由建议为 `/ai-news`。

### 3.2 页面结构

页面由四部分组成：

1. 页面标题区：显示“AI新闻资讯”和一句简短定位说明。
2. 周报操作区：选择历史周次、刷新工作台数据。
3. 同步状态区：显示最后同步时间、生成耗时、来源异常数、收录量、处理量和来源数。
4. 周报阅读区：左侧为章节目录，右侧为完整周报。

“刷新数据”只重新请求工作台 API，不触发抓取或生成任务，避免工作台跨项目控制进程。

### 3.3 周报正文

正文按报告现有结构展示：

- 本周判断。
- 核心热点。
- 产品动态。
- 工具与开源。
- 商业机会。
- 趋势信号。
- 下周观察。

热点条目应优先展示标题、重要性、分类、主信源、信源等级、热度、中文摘要、为什么重要、对个人的影响和原文入口。没有值的可选字段不显示空占位。

### 3.4 响应式行为

- 桌面端保持“工作台侧栏 + 报告目录 + 正文”三层结构。
- 窄屏隐藏工作台侧栏，报告目录变为可横向浏览的章节导航。
- 正文洞察区由双列折叠为单列。
- 任何宽度下都不使用内部正文滚动区，由页面自然滚动。

## 4. 接入方案比较

### 4.1 推送 API，采用

`ai-weekly` 在本地文件发布成功后调用工作台 API。该方案复用已经预留的 `WorkspacePublisher`，有明确的校验、重试和状态反馈。

### 4.2 工作台监听报告文件，不采用

监听 `data/reports` 可以减少一个 HTTP 接口，但会把工作台绑定到另一个项目的绝对路径，迁移、权限和错误追踪都较差。

### 4.3 工作台直接读取报告目录，不采用

直接读取实现最少，但前端读取、报告模型和文件布局会形成紧耦合，也无法形成清晰的发布成功状态。

## 5. 自动化数据流

1. Windows 计划任务每周一 09:00 调用 `ai-weekly/scripts/run.ps1`。
2. `ai-weekly` 完成采集、处理、分析和报告构建。
3. `LocalPublisher` 原子写入 JSON、Markdown 和 HTML。该步骤始终是主发布流程。
4. 当 `WORKSPACE_AUTO_PUBLISH=true` 时，`WorkspacePublisher` 将版本化 JSON 推送给工作台。
5. 工作台完成机器身份认证和请求结构校验。
6. 工作台以 `reportId` 幂等写入 SQLite。
7. 工作台响应成功后，`WorkspacePublisher` 将报告状态设为 `published`，并由 `LocalPublisher` 重写本地 JSON。
8. 页面下一次请求或刷新时显示新周报。现有前端查询缓存为 15 秒，因此无需额外轮询。

正常情况下，本次规模的任务从计划启动到页面可见约需 35 至 50 秒。实际耗时由采集网络状况决定，不作为硬性 SLA。

## 6. 发布协议

### 6.1 写入接口

```text
PUT /api/integrations/ai-news/reports/:reportId
Authorization: Bearer <WORKSPACE_TOKEN>
Content-Type: application/json
```

采用 PUT 是因为同一 `reportId` 的重复发布应覆盖同一期快照。首次写入和重复写入都返回 200，降低自动化重试复杂度。

请求体顶层包含：

- `schemaVersion`：首版固定为 `1`。
- `report`：完整周报结构。

路径中的 `reportId` 必须与 `report.report_id` 一致，否则返回 400。

成功响应包含 `reportId`、`status: "published"` 和 `importedAt`。

### 6.2 读取接口

```text
GET /api/ai-news/reports
GET /api/ai-news/reports/latest
GET /api/ai-news/reports/:reportId
```

- 列表接口只返回周次选择需要的轻量字段。
- 最新接口返回最新一期完整报告。
- 详情接口返回指定一期完整报告。
- 没有任何报告时返回语义明确的空状态，不伪造示例周报。

### 6.3 版本兼容

工作台只接受已支持的 `schemaVersion`。未知版本返回 422，并保留现有数据。报告中的可选新增字段可以被完整保存在 `payload_json` 中，从而减少两个项目同时升级的压力。

## 7. 安全设计

- Token 只从两个项目的环境变量读取，不提交 `.env`。
- 机器写入接口使用独立的长期集成 Token，不复用浏览器的临时 `x-workbench-session`。
- 工作台的全局本地会话保护只对精确的机器写入路由开放无 Origin 请求，并且必须先通过 Bearer Token 的常量时间比较。
- 其他修改接口仍要求同源浏览器请求和 `x-workbench-session`，不能因为新增集成而放宽。
- 请求体设置合理大小上限；超限、无 JSON Content-Type、认证失败或结构错误均拒绝写入。
- 原文链接只作为普通外部链接展示，不在工作台服务器端再次抓取。

## 8. 数据存储

新增 `ai_news_reports` 表：

```text
report_id        TEXT PRIMARY KEY
schema_version   INTEGER NOT NULL
title            TEXT NOT NULL
year             INTEGER NOT NULL
week             INTEGER NOT NULL
start_date       TEXT NOT NULL
end_date         TEXT NOT NULL
created_at       TEXT NOT NULL
imported_at      TEXT NOT NULL
article_count    INTEGER NOT NULL
source_count     INTEGER NOT NULL
duration_seconds REAL NOT NULL
failed_sources   INTEGER NOT NULL
payload_json     TEXT NOT NULL
```

索引字段用于列表、排序和状态展示；`payload_json` 保存完整周报快照。首版不把每个热点拆成独立关系表，因为当前需求是按期阅读完整周报，而不是跨期搜索单条事件。

同一 `report_id` 再次写入时，事务内更新全部字段和 `payload_json`。任何校验或数据库错误都不得留下部分更新。

## 9. 状态与异常处理

### 9.1 工作台未配置

未配置 API 地址或 Token 时，`WorkspacePublisher` 返回 `pending`。本地周报仍正常生成，错误信息明确指出缺少配置。

### 9.2 推送失败

网络、认证、校验或工作台写入失败时：

- `WorkspacePublisher` 返回 `failed` 并记录可诊断但不含 Secret 的错误。
- `LocalPublisher` 将失败状态写回本地 JSON。
- 工作台保留并继续展示上一次成功周报。
- 一个失败不得自动删除或覆盖已经成功保存的其他周报。

### 9.3 响应丢失

如果工作台已经写入但客户端没有收到响应，下次运行或人工重试同一 PUT。由于以 `reportId` 幂等 upsert，不会产生重复数据。

### 9.4 长时间未更新

工作台根据最新一期的 `imported_at` 判断新鲜度。超过 8 天没有新报告时，在状态区显示警告，但仍保留完整旧报告供阅读。

### 9.5 计划任务失败

如果任务在报告生成前失败，工作台不会收到推送。计划任务保留本地日志；工作台通过“超过 8 天未更新”提示间接暴露问题。首版不新增独立的运行遥测上报接口。

## 10. 配置与调度

`ai-weekly` 使用以下环境变量：

```text
WORKSPACE_CATEGORY=AI新闻资讯
WORKSPACE_AUTO_PUBLISH=true
WORKSPACE_API_URL=http://127.0.0.1:<workbench-port>
WORKSPACE_TOKEN=<secret>
```

工作台使用独立环境变量读取同一个集成 Token。

提供可重复执行的 PowerShell 安装脚本创建 Windows 计划任务：

- 每周一 09:00 运行。
- 使用运行机器的 Asia/Shanghai 本地时间。
- 调用项目内现有 `scripts/run.ps1`。
- 工作目录固定为 `ai-weekly` 项目根目录。
- 输出继续写入现有日志与报告目录。
- 重复安装应更新同名任务，而不是创建副本。

调度脚本只负责注册任务，不在安装过程中执行完整采集。

## 11. 组件边界

### 11.1 `ai-weekly`

- `WorkspacePublisher`：序列化、认证、请求、响应解析和发布状态更新。
- 调度安装脚本：注册每周任务。
- 现有 Pipeline：保持“本地发布优先，工作台发布可选”的顺序。

### 11.2 个人工作台服务端

- `ai-news-contracts`：Zod 请求和响应结构。
- `AiNewsRepository`：SQLite 幂等写入和读取。
- `AiNewsService`：报告校验、列表、最新一期和详情用例。
- `ai-news-routes`：机器写入接口与浏览器读取接口。
- 本地安全层：精确识别并保护机器写入路由。

### 11.3 个人工作台客户端

- `AiNewsPage`：加载状态、空状态、错误状态和页面编排。
- `WeeklyReportReader`：目录、完整正文和热点条目渲染。
- API 客户端：列表、最新一期、单期详情和手动刷新。

每个边界只依赖共享契约，不直接读取另一个项目的源码或数据目录。

## 12. 测试与验收

### 12.1 `ai-weekly` 测试

- 未配置时保持 `pending`。
- 成功响应后状态变为 `published`。
- 认证失败、超时、非 JSON 响应和 5xx 返回 `failed`。
- 请求使用正确方法、路径、Header 和版本化正文。
- 同一报告可安全重试。
- Pipeline 中工作台失败不影响本地文件和数据库保存。

修改发布逻辑后运行 `python -m pytest` 全量测试。

### 12.2 工作台测试

- 合法报告首次写入和重复 upsert。
- 路径与正文 `reportId` 不一致时拒绝。
- 缺少或错误 Token 时拒绝，其他修改接口安全规则不回归。
- 未知 schemaVersion、超大正文和无效字段拒绝且不写入。
- 列表按周次倒序，最新接口返回最新一期。
- 空、加载、失败、陈旧和正常状态均可渲染。
- 目录跳转、周次切换和刷新数据行为正确。
- 窄屏布局不重叠、不裁切。

运行工作台单元、集成和组件测试，并执行生产构建。

### 12.3 端到端验收

1. 手工运行一次 `ai-weekly/scripts/run.ps1`。
2. 确认本地 JSON、Markdown 和 HTML 均生成。
3. 确认工作台出现同一 `reportId` 的完整周报。
4. 再次发布同一报告，确认没有重复周报。
5. 停止工作台后再次运行，确认本地周报仍成功且状态为 failed。
6. 恢复工作台并重试，确认报告成功写入。
7. 确认 Windows 计划任务为每周一 09:00 且只有一个同名任务。

## 13. 首版不包含

- 工作台直接启动、停止或调试 AI Weekly。
- 实时新闻流或分钟级轮询。
- 邮件、消息或移动端推送。
- 多用户、权限分级、评论或协作编辑。
- 跨周热点搜索和趋势图表。
- 在工作台中修改周报内容。
