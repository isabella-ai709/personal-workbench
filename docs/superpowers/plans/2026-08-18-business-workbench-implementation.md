# 统一商务工作台实施计划

- 日期：2026-08-18
- 依据：`docs/superpowers/specs/2026-08-18-business-workbench-design.md`
- 目标：在现有 Personal Workbench 中交付可用的商务资源、销售机会、合作项目、活动时间线、跟进中心与 AI 草稿闭环。

## 实施原则

1. 沿用 Fastify、Zod、SQLite、React、TanStack Query 和 Fluent UI，不引入第二套框架。
2. 领域契约集中在共享模块，服务端和前端不复制业务枚举与类型。
3. repository 负责持久化，service 负责状态转换、事务和关联规则，routes 只负责解析输入与输出。
4. 所有删除均为软删除；状态变化和延期写入审计事件。
5. AI 只产生可编辑草稿，确认时才在事务中写入正式数据。
6. 每个阶段先补测试，再实现，并运行目标测试、类型检查和格式检查。

## 任务 1：共享契约与数据库迁移

**创建或修改**

- `src/shared/business-contracts.ts`
- `migrations/003_business_workbench.sql`
- `tests/unit/business-contracts.test.ts`
- `tests/integration/business-database.test.ts`

**内容**

- 定义公司、联系人、销售机会、合作项目、商务活动、跟进事项、总览和 AI 草稿的 Zod schema。
- 建立领域表、关联表、索引、软删除字段和业务事件表。
- 使用文本金额最小单位或整数金额，避免浮点误差；币种保存 ISO 风格代码。
- 为迁移可重复执行、外键约束、活动多对象关联和软删除写测试。

## 任务 2：公司与联系人后端闭环

**创建**

- `src/server/modules/business/business-repository.ts`
- `src/server/modules/business/business-service.ts`
- `src/server/modules/business/business-routes.ts`
- `tests/integration/business-resource-routes.test.ts`

**内容**

- 实现公司、联系人列表、详情、创建、修改、软删除和恢复。
- 实现关键词、标签、状态、公司和决策角色筛选。
- 新建和修改时返回疑似重复提示，但不自动合并。
- 公司存在活跃机会或合作时拒绝删除。

## 任务 3：销售机会与合作项目后端闭环

**修改**

- `src/server/modules/business/business-repository.ts`
- `src/server/modules/business/business-service.ts`
- `src/server/modules/business/business-routes.ts`
- `tests/integration/business-pipeline-routes.test.ts`

**内容**

- 实现销售机会和合作项目 CRUD、筛选、阶段推进和终态重开。
- 校验合法状态、结果摘要、流失原因和重开原因。
- 将每次状态变化写入业务事件表。
- 支持机会与合作项目的可选互相关联。

## 任务 4：商务活动、时间线与跟进中心

**修改**

- `src/server/modules/business/business-repository.ts`
- `src/server/modules/business/business-service.ts`
- `src/server/modules/business/business-routes.ts`
- `tests/integration/business-activity-routes.test.ts`

**内容**

- 创建商务活动并关联一个或多个业务对象。
- 按对象读取统一时间线，不重复存储活动正文。
- 实现跟进事项创建、完成、延期、取消和筛选。
- 延期和状态变化写审计事件；逾期状态由当前时间计算。

## 任务 5：商务总览与 AI 草稿

**创建或修改**

- `src/server/modules/business/business-ai.ts`
- `src/server/modules/business/business-dashboard.ts`
- `src/server/modules/business/business-routes.ts`
- `tests/integration/business-ai-routes.test.ts`
- `tests/integration/business-dashboard-routes.test.ts`

**内容**

- 聚合今日、逾期、未来七天、机会阶段、预计金额、活跃合作和最近活动。
- 定义可替换的 AI 提取器接口；生产环境通过 Codex SDK 提取结构化结果，测试使用假实现。
- AI 原文和输出先脱敏，再保存为草稿。
- 草稿确认使用事务和幂等键，可创建活动、跟进并关联已有业务对象。
- AI 不可用时返回稳定的 `UNAVAILABLE`，不影响其他接口。

## 任务 6：前端商务工作区

**创建或修改**

- `src/client/app.tsx`
- `src/client/layouts/workbench-layout.tsx`
- `src/client/api/business-client.ts`
- `src/client/pages/business-page.tsx`
- `src/client/features/business/*`
- `src/client/styles/tokens.css`
- `tests/component/business-page.test.tsx`

**内容**

- 启用侧边栏“商务对接”入口。
- 提供总览、公司/联系人、销售机会、合作项目和跟进中心五个标签页。
- 支持核心对象的创建、选择、筛选、状态推进和活动时间线。
- 在新增活动中加入 AI 整理抽屉，展示可编辑草稿后再确认。
- 保持桌面信息密度，并为窄屏降级为单列布局。

## 任务 7：接线、验收与文档

**修改**

- `src/server/app.ts`
- `src/server/main.ts`
- `README.md`
- `docs/operations.md`
- `tests/e2e/business-workbench.spec.ts`

**内容**

- 在生产服务中构造商务 repository、service、AI 提取器并注册路由。
- 更新当前能力、数据备份和 AI 降级说明。
- 覆盖资源建立、机会推进、合作推进、活动关联、跟进延期和 AI 确认的关键路径。
- 运行 `pnpm check`、目标集成测试和构建；修复所有回归。

## 提交顺序

1. `feat: add business workbench data model`
2. `feat: add business resource management API`
3. `feat: add business pipeline and follow-up API`
4. `feat: add business AI drafts and dashboard`
5. `feat: build unified business workbench UI`
6. `docs: document business workbench operations`

## 停止条件

- migration、共享契约或事务一致性失败时，不进入前端开发。
- AI 真实执行器无法稳定返回结构化结果时，保留明确的不可用降级，不以正则或静态内容冒充 AI。
- 现有任务日志、Skill 管理、安全会话或本地启动流程出现回归时，不视为交付完成。
