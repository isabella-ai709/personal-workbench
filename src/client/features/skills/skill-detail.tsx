import {
  Button,
  Field,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
} from "@fluentui/react-components";
import {
  Delete20Regular,
  FolderOpen20Regular,
  Pause20Regular,
  Play20Regular,
} from "@fluentui/react-icons";

import type { SkillOrigin, SkillSummary } from "../../../shared/contracts";
import type { SkillDetail as SkillDetailModel } from "../../api/client";
import { originCopy } from "./skill-list";

interface SkillDetailProps {
  skill: SkillSummary;
  detail?: SkillDetailModel;
  loading: boolean;
  loadFailed: boolean;
  busy: boolean;
  onToggle: () => void;
  onOrigin: (origin: Extract<SkillOrigin, "generated" | "installed" | "unconfirmed">) => void;
  onOpenFolder: () => void;
  onDelete: () => void;
}

export function SkillDetail({
  skill,
  detail,
  loading,
  loadFailed,
  busy,
  onToggle,
  onOrigin,
  onOpenFolder,
  onDelete,
}: SkillDetailProps) {
  const protectedOrigin = skill.origin === "system" || skill.origin === "plugin";
  const readOnly = skill.stale;
  return (
    <article className="skill-detail">
      <header className="skill-detail-header">
        <div>
          <h2>{skill.name}</h2>
          <p>
            {originCopy[skill.origin]}，{skill.scope}
          </p>
        </div>
        <div className="skill-detail-actions">
          <Button
            icon={skill.enabled ? <Pause20Regular /> : <Play20Regular />}
            disabled={readOnly || busy}
            onClick={onToggle}
          >
            {skill.enabled ? "停用" : "启用"}
          </Button>
          <Button appearance="subtle" icon={<FolderOpen20Regular />} onClick={onOpenFolder}>
            打开目录
          </Button>
          {skill.deletable ? (
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              disabled={readOnly || busy}
              onClick={onDelete}
            >
              删除
            </Button>
          ) : null}
        </div>
      </header>

      <p className="skill-detail-description">{skill.description || "这个 Skill 没有提供说明。"}</p>
      <div className="skill-metadata">
        <Field
          label="来源分类"
          hint={
            protectedOrigin
              ? "系统和插件来源由工作台保护，不能修改。"
              : "只有已安装或自己生成的 Skill 才能删除。"
          }
        >
          <Select
            value={skill.origin}
            disabled={protectedOrigin || readOnly || busy}
            onChange={(_, data) =>
              onOrigin(data.value as "generated" | "installed" | "unconfirmed")
            }
          >
            {protectedOrigin ? (
              <option value={skill.origin}>{originCopy[skill.origin]}</option>
            ) : null}
            <option value="unconfirmed">待确认</option>
            <option value="installed">已安装</option>
            <option value="generated">自己生成</option>
          </Select>
        </Field>
        <div>
          <span>位置</span>
          <code>{skill.location}</code>
        </div>
      </div>

      <section className="skill-instructions" aria-labelledby="skill-instructions-heading">
        <h3 id="skill-instructions-heading">说明内容</h3>
        {loading ? <Spinner size="tiny" label="正在读取 Skill" /> : null}
        {loadFailed ? (
          <MessageBar intent="error">
            <MessageBarBody>Skill 说明读取失败，文件可能已移动或无法访问。</MessageBarBody>
          </MessageBar>
        ) : null}
        {detail ? <pre>{detail.content}</pre> : null}
      </section>
    </article>
  );
}
