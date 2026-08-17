import { Badge, Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { ArrowClockwise20Regular, DocumentText20Regular } from "@fluentui/react-icons";
import { useState } from "react";

import type { TaskRun } from "../../../shared/contracts";
import { getRunLog } from "../../api/client";

interface RunDetailProps {
  run: TaskRun;
  busy: boolean;
  onRetry: (run: TaskRun) => void;
}

export function RunDetail({ run, busy, onRetry }: RunDetailProps) {
  const [log, setLog] = useState<string>();
  const [logError, setLogError] = useState(false);
  const retryable = ["failed", "cancelled", "missed"].includes(run.status);
  const loadLog = async () => {
    setLogError(false);
    try {
      setLog(await getRunLog(run.id));
    } catch {
      setLogError(true);
    }
  };
  return (
    <article className="run-detail">
      <div className="run-detail-heading">
        <Badge
          appearance="tint"
          color={
            run.status === "succeeded"
              ? "success"
              : run.status === "failed"
                ? "danger"
                : "informative"
          }
        >
          {run.status}
        </Badge>
        {run.durationMs === null ? null : <span>耗时 {(run.durationMs / 1000).toFixed(1)} 秒</span>}
      </div>
      <p>{run.resultPreview ?? run.errorMessage ?? "这次运行还没有结果摘要。"}</p>
      <div className="run-detail-actions">
        {retryable ? (
          <Button icon={<ArrowClockwise20Regular />} disabled={busy} onClick={() => onRetry(run)}>
            重新运行
          </Button>
        ) : null}
        {run.hasFullLog ? (
          <Button
            icon={<DocumentText20Regular />}
            appearance="subtle"
            onClick={() => void loadLog()}
          >
            查看完整日志
          </Button>
        ) : null}
      </div>
      {logError ? (
        <MessageBar intent="error">
          <MessageBarBody>完整日志读取失败。</MessageBarBody>
        </MessageBar>
      ) : null}
      {log ? <pre className="run-log">{log}</pre> : null}
    </article>
  );
}
