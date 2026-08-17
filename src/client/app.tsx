import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";

import { WorkbenchLayout } from "./layouts/workbench-layout";
import { DashboardPage } from "./pages/dashboard-page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

function PendingPage({ title }: { title: string }) {
  return (
    <div className="page-frame">
      <header className="page-heading">
        <h1>{title}</h1>
        <p>这个页面正在接入已完成的后端能力。</p>
      </header>
    </div>
  );
}

export function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<WorkbenchLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<PendingPage title="任务日志" />} />
            <Route path="skills" element={<PendingPage title="Skill 管理" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </QueryClientProvider>
    </FluentProvider>
  );
}
