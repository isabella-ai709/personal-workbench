import {
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
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { Retrospective } from "../../shared/retrospective-contracts";
import { ApiClientError } from "../api/client";
import {
  analyzeRetrospective,
  createRetrospective,
  deleteRetrospective,
  getRetrospectives,
  updateRetrospective,
} from "../api/retrospective-client";
import type { RetrospectiveAiAnalysis } from "../../shared/retrospective-contracts";

interface Draft {
  title: string;
  review: string;
  didWell: string;
  didWrong: string;
  lesson: string;
  nextImprovement: string;
}

const emptyDraft: Draft = {
  title: "",
  review: "",
  didWell: "",
  didWrong: "",
  lesson: "",
  nextImprovement: "",
};

function toDraft(item: Retrospective): Draft {
  return {
    title: item.title,
    review: item.review,
    didWell: item.didWell,
    didWrong: item.didWrong,
    lesson: item.lesson,
    nextImprovement: item.nextImprovement,
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "操作失败，请稍后重试";
}

export function RetrospectivesPage() {
  const queryClient = useQueryClient();
  const records = useQuery({
    queryKey: ["retrospectives"],
    queryFn: getRetrospectives,
    retry: false,
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<RetrospectiveAiAnalysis>();

  const selected = useMemo(
    () => records.data?.find((item) => item.id === selectedId),
    [records.data, selectedId],
  );
  const dirty = mode !== "view" && JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    if (!selectedId && records.data?.length) setSelectedId(records.data[0].id);
  }, [records.data, selectedId]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const protectNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (target && !window.confirm("当前复盘尚未保存，确定离开吗？")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [dirty]);

  const save = useMutation({
    mutationFn: () =>
      mode === "new"
        ? createRetrospective(draft)
        : updateRetrospective(selectedId as string, draft),
    onSuccess: async (item) => {
      setSelectedId(item.id);
      setDraft(toDraft(item));
      setBaseline(toDraft(item));
      setMode("view");
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ["retrospectives"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const remove = useMutation({
    mutationFn: () => deleteRetrospective(selectedId as string),
    onSuccess: async () => {
      setDeleteOpen(false);
      setSelectedId(undefined);
      setMode("view");
      setDraft(emptyDraft);
      setBaseline(emptyDraft);
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ["retrospectives"] });
    },
    onError: (cause) => {
      setDeleteOpen(false);
      setError(errorMessage(cause));
    },
  });
  const ai = useMutation({
    mutationFn: () => analyzeRetrospective(selectedId as string),
    onSuccess: (result) => {
      setAiAnalysis(result);
      setError(undefined);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const canDiscard = () => !dirty || window.confirm("当前复盘尚未保存，确定放弃修改吗？");
  const startNew = () => {
    if (!canDiscard()) return;
    setSelectedId(undefined);
    setDraft(emptyDraft);
    setBaseline(emptyDraft);
    setMode("new");
    setAiAnalysis(undefined);
    setError(undefined);
  };
  const selectRecord = (item: Retrospective) => {
    if (!canDiscard()) return;
    setSelectedId(item.id);
    setDraft(toDraft(item));
    setBaseline(toDraft(item));
    setMode("view");
    setAiAnalysis(undefined);
    setError(undefined);
  };
  const startEdit = () => {
    if (!selected) return;
    const value = toDraft(selected);
    setDraft(value);
    setBaseline(value);
    setMode("edit");
  };
  const cancelEdit = () => {
    if (!canDiscard()) return;
    if (selected) {
      const value = toDraft(selected);
      setDraft(value);
      setBaseline(value);
      setMode("view");
      setAiAnalysis(undefined);
    } else {
      setDraft(emptyDraft);
      setBaseline(emptyDraft);
      setMode("view");
    }
    setError(undefined);
  };
  const setField = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div className="page-frame retrospective-page">
      <header className="page-heading retrospective-heading">
        <div>
          <h1>经验复盘</h1>
          <p>用几分钟回顾一件事，把经验留下，把下一次做得更好。</p>
        </div>
        <Button appearance="primary" icon={<Add20Regular />} onClick={startNew}>
          新建复盘
        </Button>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="retrospective-workspace">
        <aside className="retrospective-list-panel" aria-label="历史复盘">
          <div className="retrospective-list-title">
            <strong>历史复盘</strong>
            <span>{records.data?.length ?? 0} 条</span>
          </div>
          {records.isPending ? (
            <div className="retrospective-loading">
              <Spinner size="small" label="正在加载" />
            </div>
          ) : records.isError ? (
            <div className="empty-state">历史记录暂时无法加载。</div>
          ) : records.data?.length ? (
            <ol className="retrospective-list">
              {records.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-selected={item.id === selectedId && mode !== "new"}
                    onClick={() => selectRecord(item)}
                  >
                    <strong>{item.title}</strong>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state">还没有复盘记录。</div>
          )}
        </aside>

        <main className="retrospective-content">
          {mode === "new" || mode === "edit" ? (
            <form
              className="retrospective-form"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="retrospective-content-heading">
                <div>
                  <span>{mode === "new" ? "新的记录" : "编辑记录"}</span>
                  <h2>{mode === "new" ? "开始一次复盘" : selected?.title}</h2>
                </div>
                <div className="retrospective-actions">
                  <Button type="button" onClick={cancelEdit} disabled={save.isPending}>
                    取消
                  </Button>
                  <Button
                    type="submit"
                    appearance="primary"
                    icon={<Save20Regular />}
                    disabled={save.isPending || !draft.title.trim()}
                  >
                    {save.isPending ? "保存中" : "保存复盘"}
                  </Button>
                </div>
              </div>
              <Field label="复盘主题" required>
                <Input
                  value={draft.title}
                  maxLength={200}
                  autoFocus
                  placeholder="例如：今天与客户沟通的复盘"
                  onChange={(_, data) => setField("title", data.value)}
                />
              </Field>
              <Field label="事情回顾" hint="发生了什么？尽量只写关键事实。">
                <Textarea
                  value={draft.review}
                  maxLength={20_000}
                  onChange={(_, data) => setField("review", data.value)}
                />
              </Field>
              <section className="retrospective-right-wrong" aria-label="做对和做错">
                <Field label="做对">
                  <Textarea
                    value={draft.didWell}
                    maxLength={20_000}
                    onChange={(_, data) => setField("didWell", data.value)}
                  />
                </Field>
                <Field label="做错">
                  <Textarea
                    value={draft.didWrong}
                    maxLength={20_000}
                    onChange={(_, data) => setField("didWrong", data.value)}
                  />
                </Field>
              </section>
              <Field label="经验总结" hint="这件事让我确认了什么规律？">
                <Textarea
                  value={draft.lesson}
                  maxLength={20_000}
                  onChange={(_, data) => setField("lesson", data.value)}
                />
              </Field>
              <Field label="下次改进" hint="写下一次可以直接执行的动作。">
                <Textarea
                  value={draft.nextImprovement}
                  maxLength={20_000}
                  onChange={(_, data) => setField("nextImprovement", data.value)}
                />
              </Field>
            </form>
          ) : selected ? (
            <article className="retrospective-detail">
              <div className="retrospective-content-heading">
                <div>
                  <span>{formatDate(selected.createdAt)}</span>
                  <h2>{selected.title}</h2>
                  {selected.updatedAt !== selected.createdAt ? (
                    <small>最后修改：{formatDate(selected.updatedAt)}</small>
                  ) : null}
                </div>
                <div className="retrospective-actions">
                  <Button
                    onClick={() => ai.mutate()}
                    disabled={ai.isPending}
                    title="调用预留的 AI 分析接口"
                  >
                    {ai.isPending ? "分析中" : "AI 分析"}
                  </Button>
                  <Button icon={<Edit20Regular />} onClick={startEdit}>
                    编辑
                  </Button>
                  <Button icon={<Delete20Regular />} onClick={() => setDeleteOpen(true)}>
                    删除
                  </Button>
                </div>
              </div>
              <RetrospectiveSection title="事情回顾" content={selected.review} />
              <div className="retrospective-detail-pair">
                <RetrospectiveSection title="做对" content={selected.didWell} />
                <RetrospectiveSection title="做错" content={selected.didWrong} />
              </div>
              <RetrospectiveSection title="经验总结" content={selected.lesson} />
              <RetrospectiveSection title="下次改进" content={selected.nextImprovement} accent />
              {aiAnalysis ? <RetrospectiveAnalysis analysis={aiAnalysis} /> : null}
            </article>
          ) : (
            <div className="retrospective-welcome">
              <div>
                <h2>把今天的经验留下来</h2>
                <p>不必写得完整。先从一件值得回看的事情开始。</p>
                <Button appearance="primary" icon={<Add20Regular />} onClick={startNew}>
                  开始复盘
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(_, data) => setDeleteOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除这条复盘？</DialogTitle>
            <DialogContent>删除后将从历史列表隐藏。数据会保留在本机数据库中。</DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteOpen(false)}>取消</Button>
              <Button
                appearance="primary"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? "删除中" : "确认删除"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function RetrospectiveSection({
  title,
  content,
  accent = false,
}: {
  title: string;
  content: string;
  accent?: boolean;
}) {
  return (
    <section className="retrospective-section" data-accent={accent || undefined}>
      <h3>{title}</h3>
      <p>{content || "未填写"}</p>
    </section>
  );
}

function RetrospectiveAnalysis({ analysis }: { analysis: RetrospectiveAiAnalysis }) {
  return (
    <section className="retrospective-ai-analysis" aria-label="AI 分析结果">
      <h3>AI 分析结果</h3>
      <p>{analysis.summary || "未生成总结"}</p>
      <AnalysisList title="做得好的地方" items={analysis.strengths} />
      <AnalysisList title="问题模式" items={analysis.issues} />
      <AnalysisList title="改进建议" items={analysis.suggestions} />
      <AnalysisList title="下一步行动" items={analysis.nextActions} />
    </section>
  );
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>未识别</p>
      )}
    </div>
  );
}
