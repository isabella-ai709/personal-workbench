import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, Search20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { SkillOrigin, SkillSummary } from "../../shared/contracts";
import {
  ApiClientError,
  deleteSkill,
  getSkill,
  getSkills,
  openSkillFolder,
  setSkillEnabled,
  setSkillOrigin,
} from "../api/client";
import { SkillDetail } from "../features/skills/skill-detail";
import { SkillList } from "../features/skills/skill-list";

type OriginFilter = "all" | SkillOrigin;

const statisticCards = [
  { key: "ai", label: "可用于 AI" },
  { key: "system", label: "系统辅助" },
  { key: "installed", label: "用户安装" },
  { key: "generated", label: "自己生成" },
] as const;

export function SkillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [selected, setSelected] = useState<SkillSummary>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string>();

  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: getSkills, retry: false });
  const detailQuery = useQuery({
    queryKey: ["skill", selected?.id],
    queryFn: () => getSkill(selected!.id),
    enabled: Boolean(selected?.id),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onMutate: () => setError(undefined),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["skills"] }),
        queryClient.invalidateQueries({ queryKey: ["skill"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (reason) =>
      setError(reason instanceof ApiClientError ? reason.message : "操作失败，请稍后再试。"),
  });

  const skills = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (skillsQuery.data ?? []).filter(
      (skill) =>
        (origin === "all" || skill.origin === origin) &&
        (!normalized ||
          skill.name.toLocaleLowerCase().includes(normalized) ||
          skill.description.toLocaleLowerCase().includes(normalized)),
    );
  }, [origin, search, skillsQuery.data]);

  useEffect(() => {
    const refreshed = selected && skills.find((skill) => skill.id === selected.id);
    setSelected(refreshed ?? skills[0]);
  }, [skills, selected]);

  const stale = skillsQuery.data?.some((skill) => skill.stale) ?? false;
  const statistics = useMemo(() => {
    const allSkills = skillsQuery.data ?? [];
    return {
      ai: allSkills.filter((skill) => skill.enabled).length,
      system: allSkills.filter((skill) => skill.origin === "system").length,
      installed: allSkills.filter((skill) => skill.origin === "installed").length,
      generated: allSkills.filter((skill) => skill.origin === "generated").length,
    };
  }, [skillsQuery.data]);
  return (
    <div className="page-frame">
      <header className="page-heading skill-page-heading">
        <div>
          <h1>Skill 管理</h1>
          <p>查看 Codex 已发现的 Skill，区分系统、插件、已安装和自己生成的内容。</p>
        </div>
        <Button icon={<ArrowClockwise20Regular />} onClick={() => void skillsQuery.refetch()}>
          刷新
        </Button>
      </header>

      <section className="skill-statistics" aria-label="Skill 统计">
        {statisticCards.map((card) => (
          <div className="skill-statistic" key={card.key}>
            <span>{card.label}</span>
            <strong>{statistics[card.key]}</strong>
          </div>
        ))}
      </section>

      {stale ? (
        <MessageBar intent="warning">
          <MessageBarBody>当前显示上次缓存。启停、来源修改和删除已经停用。</MessageBarBody>
        </MessageBar>
      ) : null}
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="skill-toolbar" aria-label="Skill 筛选">
        <Input
          contentBefore={<Search20Regular />}
          value={search}
          placeholder="搜索名称或说明"
          aria-label="搜索 Skill"
          onChange={(_, data) => setSearch(data.value)}
        />
        <Select
          aria-label="Skill 来源"
          value={origin}
          onChange={(_, data) => setOrigin(data.value as OriginFilter)}
        >
          <option value="all">全部来源</option>
          <option value="generated">自己生成</option>
          <option value="installed">已安装</option>
          <option value="unconfirmed">待确认</option>
          <option value="plugin">插件</option>
          <option value="system">系统</option>
        </Select>
      </div>

      {skillsQuery.isPending ? (
        <div className="page-loading">
          <Spinner label="正在读取 Skill" />
        </div>
      ) : skillsQuery.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>Skill 列表读取失败，请确认 Codex 可以正常启动。</MessageBarBody>
        </MessageBar>
      ) : (
        <div className="skill-workspace">
          <section className="skill-list-panel" aria-label="Skill 列表">
            <SkillList skills={skills} selectedId={selected?.id} onSelect={setSelected} />
          </section>
          <section className="skill-detail-panel" aria-label="Skill 详情">
            {selected ? (
              <SkillDetail
                skill={selected}
                detail={detailQuery.data}
                loading={detailQuery.isPending}
                loadFailed={detailQuery.isError}
                busy={mutation.isPending}
                onToggle={() =>
                  mutation.mutate(() => setSkillEnabled(selected.id, !selected.enabled))
                }
                onOrigin={(next) => mutation.mutate(() => setSkillOrigin(selected.id, next))}
                onOpenFolder={() => mutation.mutate(() => openSkillFolder(selected.id))}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : (
              <div className="empty-state">选择一个 Skill 查看说明。</div>
            )}
          </section>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={(_, data) => setDeleteOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除 Skill</DialogTitle>
            <DialogContent>
              工作台会先停用这个 Skill，再将整个 Skill 目录移入 Windows
              系统回收站。系统、插件和待确认来源不能删除。
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteOpen(false)}>取消</Button>
              <Button
                appearance="primary"
                disabled={!selected?.deletable || mutation.isPending}
                onClick={() =>
                  selected &&
                  mutation.mutate(async () => {
                    await deleteSkill(selected.id);
                    setDeleteOpen(false);
                    setSelected(undefined);
                  })
                }
              >
                移入回收站
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
