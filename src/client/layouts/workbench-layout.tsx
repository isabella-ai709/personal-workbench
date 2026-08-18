import {
  AppsListDetail24Regular,
  Briefcase24Regular,
  Clock24Regular,
  Home24Regular,
  PlugConnected24Regular,
  Toolbox24Regular,
} from "@fluentui/react-icons";
import { NavLink, Outlet } from "react-router-dom";

const activeItems = [
  { to: "/", label: "首页", icon: <Home24Regular /> },
  { to: "/tasks", label: "任务计划", icon: <Clock24Regular /> },
  { to: "/skills", label: "Skill 管理", icon: <Toolbox24Regular /> },
  { to: "/business", label: "商务对接", icon: <Briefcase24Regular /> },
  { to: "/retrospectives", label: "经验复盘", icon: <AppsListDetail24Regular /> },
];

const futureItems = [{ label: "API 管理", icon: <PlugConnected24Regular /> }];

export function WorkbenchLayout() {
  return (
    <div className="workbench-shell">
      <aside className="workbench-sidebar" aria-label="工作台导航">
        <div className="workbench-brand">
          <span className="workbench-brand-mark" aria-hidden="true">
            C
          </span>
          <span className="workbench-brand-copy">
            <strong>个人工作台</strong>
            <span>Codex 助理控制台</span>
          </span>
        </div>
        <nav className="workbench-nav">
          {activeItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          <div className="workbench-nav-section" aria-label="后续版本">
            <span className="workbench-nav-label">后续版本</span>
            {futureItems.map((item) => (
              <span key={item.label} className="workbench-nav-disabled" aria-disabled="true">
                <span>
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                <span className="workbench-later">未启用</span>
              </span>
            ))}
          </div>
        </nav>
      </aside>
      <main className="workbench-main">
        <Outlet />
      </main>
    </div>
  );
}
