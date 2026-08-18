import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Bot20Regular,
  Checkmark20Regular,
  NoteAdd20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type {
  BusinessAiDraft,
  FollowUp,
  OpportunityStage,
  PartnershipStatus,
} from "../../shared/business-contracts";
import { ApiClientError } from "../api/client";
import {
  changeFollowUpStatus,
  changeOpportunityStage,
  changePartnershipStatus,
  confirmAiDraft,
  createActivity,
  createCompany,
  createContact,
  createFollowUp,
  createOpportunity,
  createPartnership,
  generateAiDraft,
  getActivities,
  getBusinessDashboard,
  getCompanies,
  getContacts,
  getFollowUps,
  getOpportunities,
  getPartnerships,
} from "../api/business-client";

type View = "overview" | "resources" | "opportunities" | "partnerships" | "followups";
type FormKind = "company" | "contact" | "opportunity" | "partnership" | "followup" | "activity";

const opportunityLabels: Record<OpportunityStage, string> = {
  lead: "线索",
  contacted: "已接洽",
  needs_confirmed: "需求确认",
  proposal: "方案/报价",
  negotiation: "谈判",
  won: "成交",
  lost: "流失",
};
const partnershipLabels: Record<PartnershipStatus, string> = {
  idea: "构想",
  contacting: "接洽中",
  proposal_confirmed: "方案确认",
  executing: "执行中",
  completed: "已完成",
  terminated: "已终止",
  paused: "暂停",
};
const relationshipLabels = {
  lead: "潜在线索",
  contacted: "接洽中",
  active: "合作中",
  former: "历史合作",
  paused: "暂不跟进",
} as const;

function dateTime(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未设置";
}
function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}
function toIso(value: FormDataEntryValue | null) {
  return value ? new Date(String(value)).toISOString() : null;
}

export function BusinessPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [formKind, setFormKind] = useState<FormKind>();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRaw, setAiRaw] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiCompanyId, setAiCompanyId] = useState("");
  const [aiDraft, setAiDraft] = useState<BusinessAiDraft>();
  const [error, setError] = useState<string>();

  const dashboard = useQuery({
    queryKey: ["business", "dashboard"],
    queryFn: getBusinessDashboard,
    retry: false,
  });
  const companies = useQuery({
    queryKey: ["business", "companies"],
    queryFn: getCompanies,
    retry: false,
  });
  const contacts = useQuery({
    queryKey: ["business", "contacts"],
    queryFn: getContacts,
    retry: false,
  });
  const opportunities = useQuery({
    queryKey: ["business", "opportunities"],
    queryFn: getOpportunities,
    retry: false,
  });
  const partnerships = useQuery({
    queryKey: ["business", "partnerships"],
    queryFn: getPartnerships,
    retry: false,
  });
  const activities = useQuery({
    queryKey: ["business", "activities"],
    queryFn: getActivities,
    retry: false,
  });
  const followUps = useQuery({
    queryKey: ["business", "followups"],
    queryFn: getFollowUps,
    retry: false,
  });
  const loading = [
    dashboard,
    companies,
    contacts,
    opportunities,
    partnerships,
    activities,
    followUps,
  ].some((query) => query.isPending);
  const loadError = [
    dashboard,
    companies,
    contacts,
    opportunities,
    partnerships,
    activities,
    followUps,
  ].some((query) => query.isError);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["business"] });
  const operation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onMutate: () => setError(undefined),
    onSuccess: () => void refresh(),
    onError: (reason) =>
      setError(reason instanceof ApiClientError ? reason.message : "操作失败，请稍后再试。"),
  });

  const normalized = search.trim().toLocaleLowerCase();
  const companyItems = useMemo(
    () =>
      (companies.data ?? []).filter(
        (item) =>
          !normalized ||
          [item.name, item.industry, item.region, ...item.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized),
      ),
    [companies.data, normalized],
  );
  const contactItems = useMemo(
    () =>
      (contacts.data ?? []).filter(
        (item) =>
          !normalized ||
          [item.name, item.title, item.phone, item.email]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized),
      ),
    [contacts.data, normalized],
  );

  const openForm = (kind: FormKind) => {
    setError(undefined);
    setFormKind(kind);
  };
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    operation.mutate(async () => {
      if (formKind === "company")
        await createCompany({
          name: text("name"),
          industry: text("industry"),
          region: text("region"),
          tags: text("tags")
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
        });
      if (formKind === "contact")
        await createContact({
          name: text("name"),
          companyId: text("companyId") || null,
          title: text("title"),
          phone: text("phone"),
          email: text("email"),
        });
      if (formKind === "opportunity")
        await createOpportunity({
          name: text("name"),
          companyId: text("companyId") || null,
          needs: text("needs"),
          amountMinor: text("amount") ? Math.round(Number(text("amount")) * 100) : null,
        });
      if (formKind === "partnership")
        await createPartnership({
          name: text("name"),
          companyId: text("companyId") || null,
          type: text("type"),
          objective: text("objective"),
        });
      if (formKind === "followup")
        await createFollowUp({
          title: text("name"),
          dueAt: toIso(data.get("dueAt"))!,
          companyId: text("companyId") || null,
          priority: text("priority") as FollowUp["priority"],
        });
      if (formKind === "activity")
        await createActivity({
          summary: text("summary"),
          rawContent: text("rawContent"),
          companyId: text("companyId") || null,
          type: text("type") as "call" | "visit" | "meeting" | "wechat" | "email" | "note",
          occurredAt: new Date().toISOString(),
        });
      setFormKind(undefined);
    });
  };

  const updateOpportunity = (id: string, current: OpportunityStage, next: OpportunityStage) => {
    if (current === next) return;
    let resultSummary = "",
      lossReason = "",
      reason = "";
    if (["won", "lost"].includes(next))
      resultSummary = window.prompt("请输入结果摘要")?.trim() ?? "";
    if (next === "lost") lossReason = window.prompt("请输入流失原因")?.trim() ?? "";
    if (["won", "lost"].includes(current))
      reason = window.prompt("请输入重新开启原因")?.trim() ?? "";
    operation.mutate(() =>
      changeOpportunityStage(id, { stage: next, resultSummary, lossReason, reason }),
    );
  };
  const updatePartnership = (id: string, current: PartnershipStatus, next: PartnershipStatus) => {
    if (current === next) return;
    let resultSummary = "",
      reason = "";
    if (["completed", "terminated"].includes(next))
      resultSummary = window.prompt("请输入合作结果摘要")?.trim() ?? "";
    if (["completed", "terminated"].includes(current))
      reason = window.prompt("请输入重新开启原因")?.trim() ?? "";
    operation.mutate(() => changePartnershipStatus(id, { status: next, resultSummary, reason }));
  };

  const generate = () =>
    operation.mutate(async () => {
      const draft = await generateAiDraft(aiRaw);
      setAiDraft(draft);
      setAiSummary(draft.summary);
    });
  const confirm = () => {
    if (!aiDraft || !aiCompanyId) {
      setError("请选择关联公司后再确认 AI 草稿。");
      return;
    }
    operation.mutate(async () => {
      await confirmAiDraft(aiDraft.id, {
        activity: {
          summary: aiSummary,
          rawContent: aiDraft.rawContent,
          companyId: aiCompanyId,
          occurredAt: new Date().toISOString(),
        },
        followUps: aiDraft.nextActions
          .filter((item) => item.dueAt)
          .map((item) => ({ title: item.title, dueAt: item.dueAt!, companyId: aiCompanyId })),
      });
      setAiOpen(false);
      setAiDraft(undefined);
      setAiRaw("");
      setAiSummary("");
    });
  };

  return (
    <div className="page-frame business-page">
      <header className="page-heading business-heading">
        <div>
          <h1>商务合作</h1>
          <p>统一管理关系、销售机会、合作项目、沟通记录和下一步行动。</p>
        </div>
        <div className="business-heading-actions">
          <Button icon={<NoteAdd20Regular />} onClick={() => openForm("activity")}>
            记录沟通
          </Button>
          <Button appearance="primary" icon={<Bot20Regular />} onClick={() => setAiOpen(true)}>
            AI 整理
          </Button>
        </div>
      </header>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      {loadError ? (
        <MessageBar intent="error">
          <MessageBarBody>商务数据读取失败，请确认本机服务已启动。</MessageBarBody>
        </MessageBar>
      ) : null}
      <TabList
        selectedValue={view}
        onTabSelect={(_, data) => setView(data.value as View)}
        className="business-tabs"
      >
        <Tab value="overview">总览</Tab>
        <Tab value="resources">公司与联系人</Tab>
        <Tab value="opportunities">销售机会</Tab>
        <Tab value="partnerships">合作项目</Tab>
        <Tab value="followups">跟进中心</Tab>
      </TabList>
      {loading ? (
        <div className="page-loading">
          <Spinner label="正在读取商务数据" />
        </div>
      ) : null}
      {!loading && view === "overview" && dashboard.data ? (
        <div className="business-overview">
          <section className="business-metrics" aria-label="商务概况">
            <div>
              <span>今日跟进</span>
              <strong>{dashboard.data.followUps.dueToday}</strong>
              <small>{dashboard.data.followUps.overdue} 项已逾期</small>
            </div>
            <div>
              <span>销售机会</span>
              <strong>{dashboard.data.opportunities.active}</strong>
              <small>{money(dashboard.data.opportunities.amountMinor)} 预计金额</small>
            </div>
            <div>
              <span>进行中合作</span>
              <strong>{dashboard.data.activePartnerships}</strong>
              <small>等待推进或交付</small>
            </div>
            <div>
              <span>商务资源</span>
              <strong>{dashboard.data.companies + dashboard.data.contacts}</strong>
              <small>
                {dashboard.data.companies} 家公司，{dashboard.data.contacts} 位联系人
              </small>
            </div>
          </section>
          <div className="business-overview-grid">
            <section className="business-panel">
              <div className="business-section-heading">
                <h2>待处理跟进</h2>
                <Button appearance="subtle" onClick={() => setView("followups")}>
                  查看全部
                </Button>
              </div>
              <BusinessFollowUps
                items={(followUps.data ?? [])
                  .filter((item) => item.status === "pending")
                  .slice(0, 6)}
                busy={operation.isPending}
                onComplete={(id) => operation.mutate(() => changeFollowUpStatus(id, "completed"))}
              />
            </section>
            <section className="business-panel">
              <div className="business-section-heading">
                <h2>最近沟通</h2>
                <Button appearance="subtle" onClick={() => openForm("activity")}>
                  新增记录
                </Button>
              </div>
              <ActivityList items={activities.data?.slice(0, 6) ?? []} />
            </section>
          </div>
        </div>
      ) : null}
      {!loading && view === "resources" ? (
        <div>
          <div className="business-toolbar">
            <Input
              value={search}
              onChange={(_, d) => setSearch(d.value)}
              placeholder="搜索公司、行业或联系人"
              aria-label="搜索商务资源"
            />
            <Button icon={<Add20Regular />} onClick={() => openForm("company")}>
              新增公司
            </Button>
            <Button icon={<Add20Regular />} onClick={() => openForm("contact")}>
              新增联系人
            </Button>
          </div>
          <div className="business-split">
            <section className="business-panel">
              <h2>公司</h2>
              <div className="business-records">
                {companyItems.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.industry || "行业未填写"}
                        {item.region ? `，${item.region}` : ""}
                      </span>
                    </div>
                    <Badge appearance="tint">{relationshipLabels[item.relationshipStatus]}</Badge>
                  </article>
                ))}
                {companyItems.length === 0 ? (
                  <div className="empty-state">还没有公司记录。</div>
                ) : null}
              </div>
            </section>
            <section className="business-panel">
              <h2>联系人</h2>
              <div className="business-records">
                {contactItems.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.title || "职位未填写"}
                        {item.phone ? `，${item.phone}` : ""}
                      </span>
                    </div>
                    <small>关系 {item.relationshipLevel}/5</small>
                  </article>
                ))}
                {contactItems.length === 0 ? (
                  <div className="empty-state">还没有联系人记录。</div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
      {!loading && view === "opportunities" ? (
        <section>
          <div className="business-toolbar">
            <h2>销售机会</h2>
            <Button
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => openForm("opportunity")}
            >
              新增机会
            </Button>
          </div>
          <div className="pipeline-grid">
            {(opportunities.data ?? []).map((item) => (
              <article className="pipeline-card" key={item.id}>
                <div>
                  <Badge appearance="tint">{opportunityLabels[item.stage]}</Badge>
                  <h3>{item.name}</h3>
                  <p>{item.needs || "尚未填写需求摘要"}</p>
                </div>
                <div className="pipeline-meta">
                  <strong>
                    {item.amountMinor === null ? "金额待确认" : money(item.amountMinor)}
                  </strong>
                  <span>{item.probability}% 概率</span>
                </div>
                <Select
                  aria-label={`修改 ${item.name} 阶段`}
                  value={item.stage}
                  onChange={(_, d) =>
                    updateOpportunity(item.id, item.stage, d.value as OpportunityStage)
                  }
                >
                  {Object.entries(opportunityLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </article>
            ))}
            {opportunities.data?.length === 0 ? (
              <div className="empty-state">还没有销售机会。</div>
            ) : null}
          </div>
        </section>
      ) : null}
      {!loading && view === "partnerships" ? (
        <section>
          <div className="business-toolbar">
            <h2>合作项目</h2>
            <Button
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => openForm("partnership")}
            >
              新增合作
            </Button>
          </div>
          <div className="partnership-list">
            {(partnerships.data ?? []).map((item) => (
              <article key={item.id}>
                <div>
                  <Badge appearance="tint">{partnershipLabels[item.status]}</Badge>
                  <h3>{item.name}</h3>
                  <p>{item.objective || "尚未填写合作目标"}</p>
                </div>
                <div>
                  <span>{item.type || "合作类型未填写"}</span>
                  <Select
                    aria-label={`修改 ${item.name} 状态`}
                    value={item.status}
                    onChange={(_, d) =>
                      updatePartnership(item.id, item.status, d.value as PartnershipStatus)
                    }
                  >
                    {Object.entries(partnershipLabels).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </article>
            ))}
            {partnerships.data?.length === 0 ? (
              <div className="empty-state">还没有合作项目。</div>
            ) : null}
          </div>
        </section>
      ) : null}
      {!loading && view === "followups" ? (
        <section>
          <div className="business-toolbar">
            <h2>跟进中心</h2>
            <Button
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => openForm("followup")}
            >
              新增跟进
            </Button>
          </div>
          <div className="business-panel">
            <BusinessFollowUps
              items={followUps.data ?? []}
              busy={operation.isPending}
              onComplete={(id) => operation.mutate(() => changeFollowUpStatus(id, "completed"))}
            />
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(formKind)} onOpenChange={(_, d) => !d.open && setFormKind(undefined)}>
        <DialogSurface>
          <form onSubmit={submitForm}>
            <DialogBody>
              <DialogTitle>{formTitle(formKind)}</DialogTitle>
              <DialogContent>
                <div className="business-form">
                  {formKind ? (
                    <BusinessForm kind={formKind} companies={companies.data ?? []} />
                  ) : null}
                </div>
              </DialogContent>
              <DialogActions>
                <Button type="button" onClick={() => setFormKind(undefined)}>
                  取消
                </Button>
                <Button type="submit" appearance="primary" disabled={operation.isPending}>
                  保存
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
      <Dialog open={aiOpen} onOpenChange={(_, d) => setAiOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>AI 整理商务内容</DialogTitle>
            <DialogContent>
              <div className="business-form ai-draft-form">
                {!aiDraft ? (
                  <>
                    <Field label="聊天记录或会议纪要" required>
                      <Textarea
                        resize="vertical"
                        value={aiRaw}
                        onChange={(_, d) => setAiRaw(d.value)}
                        placeholder="粘贴需要整理的原始内容"
                      />
                    </Field>
                    <p className="form-help">内容只用于生成草稿。确认前不会修改正式商务数据。</p>
                  </>
                ) : (
                  <>
                    <Field label="沟通摘要" required>
                      <Textarea value={aiSummary} onChange={(_, d) => setAiSummary(d.value)} />
                    </Field>
                    <Field label="关联公司" required>
                      <Select value={aiCompanyId} onChange={(_, d) => setAiCompanyId(d.value)}>
                        <option value="">请选择公司</option>
                        {companies.data?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="ai-extraction">
                      <strong>识别结果</strong>
                      <p>需求：{aiDraft.needs.join("；") || "未识别"}</p>
                      <p>事实：{aiDraft.facts.join("；") || "未识别"}</p>
                      <p>风险：{aiDraft.risks.join("；") || "未识别"}</p>
                      <p>
                        下一步：
                        {aiDraft.nextActions.map((item) => item.title).join("；") || "未识别"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAiOpen(false)}>取消</Button>
              {aiDraft ? (
                <Button appearance="primary" disabled={operation.isPending} onClick={confirm}>
                  确认写入
                </Button>
              ) : (
                <Button
                  appearance="primary"
                  disabled={!aiRaw.trim() || operation.isPending}
                  onClick={generate}
                >
                  生成草稿
                </Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function BusinessFollowUps({
  items,
  busy,
  onComplete,
}: {
  items: FollowUp[];
  busy: boolean;
  onComplete: (id: string) => void;
}) {
  if (!items.length) return <div className="empty-state">当前没有跟进事项。</div>;
  return (
    <div className="followup-list">
      {items.map((item) => (
        <article
          key={item.id}
          data-overdue={item.status === "pending" && new Date(item.dueAt) < new Date()}
        >
          <div>
            <strong>{item.title}</strong>
            <span>
              {dateTime(item.dueAt)}，
              {item.priority === "high"
                ? "高优先级"
                : item.priority === "medium"
                  ? "中优先级"
                  : "低优先级"}
            </span>
          </div>
          <Badge
            appearance="tint"
            color={
              item.status === "completed"
                ? "success"
                : item.status === "cancelled"
                  ? "subtle"
                  : "informative"
            }
          >
            {item.status === "completed"
              ? "已完成"
              : item.status === "cancelled"
                ? "已取消"
                : "待处理"}
          </Badge>
          {item.status === "pending" ? (
            <Button
              appearance="subtle"
              icon={<Checkmark20Regular />}
              disabled={busy}
              onClick={() => onComplete(item.id)}
            >
              完成
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
function ActivityList({ items }: { items: Awaited<ReturnType<typeof getActivities>> }) {
  if (!items.length) return <div className="empty-state">还没有沟通记录。</div>;
  return (
    <div className="activity-list">
      {items.map((item) => (
        <article key={item.id}>
          <time dateTime={item.occurredAt}>{dateTime(item.occurredAt)}</time>
          <strong>{item.summary}</strong>
          <span>
            {item.type === "meeting"
              ? "会议"
              : item.type === "call"
                ? "电话"
                : item.type === "wechat"
                  ? "微信"
                  : item.type === "email"
                    ? "邮件"
                    : item.type === "visit"
                      ? "拜访"
                      : "备注"}
          </span>
        </article>
      ))}
    </div>
  );
}
function formTitle(kind: FormKind | undefined) {
  return (
    (
      {
        company: "新增公司",
        contact: "新增联系人",
        opportunity: "新增销售机会",
        partnership: "新增合作项目",
        followup: "新增跟进事项",
        activity: "记录商务沟通",
      } as Record<FormKind, string>
    )[kind as FormKind] ?? "新增记录"
  );
}
function CompanySelect({ companies }: { companies: Awaited<ReturnType<typeof getCompanies>> }) {
  return (
    <Field label="关联公司">
      <Select name="companyId">
        <option value="">暂不关联</option>
        {companies.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
function BusinessForm({
  kind,
  companies,
}: {
  kind: FormKind;
  companies: Awaited<ReturnType<typeof getCompanies>>;
}) {
  if (kind === "company")
    return (
      <>
        <Field label="公司名称" required>
          <Input name="name" required />
        </Field>
        <Field label="行业">
          <Input name="industry" />
        </Field>
        <Field label="地区">
          <Input name="region" />
        </Field>
        <Field label="标签">
          <Input name="tags" placeholder="多个标签用逗号分隔" />
        </Field>
      </>
    );
  if (kind === "contact")
    return (
      <>
        <Field label="姓名" required>
          <Input name="name" required />
        </Field>
        <CompanySelect companies={companies} />
        <Field label="职位">
          <Input name="title" />
        </Field>
        <Field label="手机">
          <Input name="phone" />
        </Field>
        <Field label="邮箱">
          <Input name="email" type="email" />
        </Field>
      </>
    );
  if (kind === "opportunity")
    return (
      <>
        <Field label="机会名称" required>
          <Input name="name" required />
        </Field>
        <CompanySelect companies={companies} />
        <Field label="需求摘要">
          <Textarea name="needs" />
        </Field>
        <Field label="预计金额（元）">
          <Input name="amount" type="number" min="0" />
        </Field>
      </>
    );
  if (kind === "partnership")
    return (
      <>
        <Field label="合作名称" required>
          <Input name="name" required />
        </Field>
        <CompanySelect companies={companies} />
        <Field label="合作类型">
          <Input name="type" placeholder="渠道合作、联合活动等" />
        </Field>
        <Field label="合作目标">
          <Textarea name="objective" />
        </Field>
      </>
    );
  if (kind === "followup")
    return (
      <>
        <Field label="事项名称" required>
          <Input name="name" required />
        </Field>
        <CompanySelect companies={companies} />
        <Field label="截止时间" required>
          <Input name="dueAt" type="datetime-local" required />
        </Field>
        <Field label="优先级">
          <Select name="priority" defaultValue="medium">
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </Select>
        </Field>
      </>
    );
  return (
    <>
      <Field label="沟通摘要" required>
        <Textarea name="summary" required />
      </Field>
      <CompanySelect companies={companies} />
      <Field label="沟通方式">
        <Select name="type" defaultValue="note">
          <option value="note">备注</option>
          <option value="wechat">微信</option>
          <option value="call">电话</option>
          <option value="meeting">会议</option>
          <option value="visit">拜访</option>
          <option value="email">邮件</option>
        </Select>
      </Field>
      <Field label="原始内容">
        <Textarea name="rawContent" />
      </Field>
    </>
  );
}
