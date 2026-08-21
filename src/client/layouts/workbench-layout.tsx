import {
  AppsListDetail24Regular,
  Alert24Regular,
  Briefcase24Regular,
  ChevronDown16Regular,
  Clock24Regular,
  Home24Regular,
  PlugConnected24Regular,
  News24Regular,
  Toolbox24Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { getNotificationSummary } from "../api/notification-client";

const activeItems = [
  { to: "/", label: "首页", icon: <Home24Regular /> },
  { to: "/notifications", label: "消息提醒", icon: <Alert24Regular /> },
  { to: "/tasks", label: "任务计划", icon: <Clock24Regular /> },
  { to: "/skills", label: "Skill 管理", icon: <Toolbox24Regular /> },
  { to: "/business", label: "商务合作", icon: <Briefcase24Regular /> },
  { to: "/retrospectives", label: "经验复盘", icon: <AppsListDetail24Regular /> },
];

const futureItems = [{ label: "API 管理", icon: <PlugConnected24Regular /> }];

export function WorkbenchLayout() {
  const location = useLocation();
  const [aiNewsExpanded, setAiNewsExpanded] = useState(() =>
    location.pathname.startsWith("/ai-news"),
  );
  const summary = useQuery({
    queryKey: ["notification-summary"],
    queryFn: getNotificationSummary,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (location.pathname.startsWith("/ai-news/opportunities")) {
      setAiNewsExpanded(true);
    } else if (!location.pathname.startsWith("/ai-news")) {
      setAiNewsExpanded(false);
    }
  }, [location.pathname]);

  return (
    <div className="workbench-shell">
      <aside className="workbench-sidebar" aria-label="工作台导航">
        <div className="workbench-brand">
          <img
            className="workbench-brand-mark"
            src="/isabella-avatar.jpg"
            alt=""
            aria-hidden="true"
          />
          <span className="workbench-brand-copy">
            <strong>Isabella.Y 工作台</strong>
            <span>Personal workspace</span>
          </span>
        </div>
        <nav className="workbench-nav">
          {activeItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/" || item.to === "/ai-news"}>
              {item.icon}
              <span>{item.label}</span>
              {item.to === "/notifications" && (summary.data?.importantUnread ?? 0) > 0 ? (
                <span
                  className="notification-nav-badge"
                  aria-label={`${summary.data?.importantUnread} 条重要未读消息`}
                >
                  {(summary.data?.importantUnread ?? 0) > 99
                    ? "99+"
                    : summary.data?.importantUnread}
                </span>
              ) : null}
            </NavLink>
          ))}
          <NavLink
            to="/ai-news"
            end
            className="workbench-nav-parent"
            aria-expanded={aiNewsExpanded}
            onClick={() => setAiNewsExpanded((expanded) => !expanded)}
          >
            <News24Regular />
            <span>AI新闻资讯</span>
            <ChevronDown16Regular className="workbench-nav-chevron" aria-hidden="true" />
          </NavLink>
          {aiNewsExpanded ? (
            <div className="workbench-nav-submenu" aria-label="AI新闻资讯子频道">
              <NavLink to="/ai-news/opportunities" className="workbench-nav-child">
                <News24Regular />
                <span>小D机会</span>
              </NavLink>
            </div>
          ) : null}
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
