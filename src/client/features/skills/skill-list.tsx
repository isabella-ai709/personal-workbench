import { Badge } from "@fluentui/react-components";

import type { SkillOrigin, SkillSummary } from "../../../shared/contracts";

export const originCopy: Record<SkillOrigin, string> = {
  system: "系统",
  plugin: "插件",
  generated: "自己生成",
  installed: "已安装",
  unconfirmed: "待确认",
};

interface SkillListProps {
  skills: SkillSummary[];
  selectedId?: string;
  onSelect: (skill: SkillSummary) => void;
}

const originOrder: SkillOrigin[] = ["system", "plugin", "installed", "generated", "unconfirmed"];

export function SkillList({ skills, selectedId, onSelect }: SkillListProps) {
  if (skills.length === 0) return <div className="empty-state">没有符合条件的 Skill。</div>;
  return (
    <div className="skill-groups">
      {originOrder.map((groupOrigin) => {
        const group = skills.filter((skill) => skill.origin === groupOrigin);
        if (group.length === 0) return null;
        return (
          <section
            className="skill-group"
            key={groupOrigin}
            aria-labelledby={`skill-group-${groupOrigin}`}
          >
            <h3 id={`skill-group-${groupOrigin}`}>
              <span>{originCopy[groupOrigin]}</span>
              <span>{group.length}</span>
            </h3>
            <ul className="skill-list">
              {group.map((skill) => (
                <li key={skill.id}>
                  <button data-selected={skill.id === selectedId} onClick={() => onSelect(skill)}>
                    <span className="skill-list-heading">
                      <strong>{skill.name}</strong>
                      <Badge appearance="tint" color={skill.enabled ? "success" : "subtle"}>
                        {skill.enabled ? "已启用" : "已停用"}
                      </Badge>
                    </span>
                    <span className="skill-description">{skill.description || "没有说明"}</span>
                    <span className="skill-origin">{originCopy[skill.origin]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
