import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { WorkbenchLayout } from "./layouts/workbench-layout";
import { DashboardPage } from "./pages/dashboard-page";

const TaskPlansPage = lazy(() =>
  import("./pages/task-plans-page").then((module) => ({ default: module.TaskPlansPage })),
);
const SkillsPage = lazy(() =>
  import("./pages/skills-page").then((module) => ({ default: module.SkillsPage })),
);
const BusinessPage = lazy(() =>
  import("./pages/business-page").then((module) => ({ default: module.BusinessPage })),
);
const RetrospectivesPage = lazy(() =>
  import("./pages/retrospectives-page").then((module) => ({
    default: module.RetrospectivesPage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<WorkbenchLayout />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="tasks"
              element={
                <Suspense fallback={<div className="page-loading">正在加载任务计划</div>}>
                  <TaskPlansPage />
                </Suspense>
              }
            />
            <Route
              path="skills"
              element={
                <Suspense fallback={<div className="page-loading">正在加载 Skill 管理</div>}>
                  <SkillsPage />
                </Suspense>
              }
            />
            <Route
              path="business"
              element={
                <Suspense fallback={<div className="page-loading">正在加载商务对接</div>}>
                  <BusinessPage />
                </Suspense>
              }
            />
            <Route
              path="retrospectives"
              element={
                <Suspense fallback={<div className="page-loading">正在加载经验复盘</div>}>
                  <RetrospectivesPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </QueryClientProvider>
    </FluentProvider>
  );
}
