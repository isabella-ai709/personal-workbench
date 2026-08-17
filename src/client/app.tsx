import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { WorkbenchLayout } from "./layouts/workbench-layout";
import { DashboardPage } from "./pages/dashboard-page";

const TasksPage = lazy(() =>
  import("./pages/tasks-page").then((module) => ({ default: module.TasksPage })),
);
const SkillsPage = lazy(() =>
  import("./pages/skills-page").then((module) => ({ default: module.SkillsPage })),
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
                <Suspense fallback={<div className="page-loading">正在加载任务日志</div>}>
                  <TasksPage />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </QueryClientProvider>
    </FluentProvider>
  );
}
