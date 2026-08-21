import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getAiOpportunityReport,
  getAiOpportunityReports,
  getLatestAiOpportunityReport,
} from "../api/ai-opportunity-client";

export function AiOpportunitiesPage() {
  const [selectedId, setSelectedId] = useState("");
  const reports = useQuery({
    queryKey: ["ai-opportunity-reports"],
    queryFn: getAiOpportunityReports,
    retry: false,
  });
  const report = useQuery({
    queryKey: ["ai-opportunity-report", selectedId || "latest"],
    queryFn: () =>
      selectedId ? getAiOpportunityReport(selectedId) : getLatestAiOpportunityReport(),
    retry: false,
  });
  const refresh = () => void Promise.all([reports.refetch(), report.refetch()]);

  if (report.isPending)
    return (
      <div className="page-frame">
        <p>正在加载小D机会周报…</p>
      </div>
    );
  if (report.isError)
    return (
      <div className="page-frame">
        <MessageBar intent="error">
          <MessageBarBody>小D机会周报暂时无法读取。</MessageBarBody>
        </MessageBar>
        <Button onClick={refresh}>重新加载</Button>
      </div>
    );
  const detail = report.data;
  const data = detail?.report;
  const recommended = data?.side_hustles.find(
    (item) => item.id === data.recommended_opportunity_id,
  );

  return (
    <div className="page-frame ai-news-page xiaod-page">
      <header className="page-heading ai-news-page-heading">
        <div>
          <p className="xiaod-eyebrow">AI新闻资讯 / 子频道</p>
          <h1>小D机会</h1>
          <p>从过去 7 天 AI 资讯中提炼能成交、能复制、能落地的机会。</p>
        </div>
        <div className="ai-news-actions">
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">最新一期</option>
            {reports.data?.map((item) => (
              <option key={item.reportId} value={item.reportId}>
                {item.year}年第{item.week}周
              </option>
            ))}
          </select>
          <Button icon={<ArrowClockwise20Regular />} onClick={refresh}>
            刷新数据
          </Button>
        </div>
      </header>
      {!data ? (
        <div className="ai-news-empty">
          <h2>还没有小D机会周报</h2>
          <p>自动化首次推送后，这里会显示完整的商业机会分析。</p>
        </div>
      ) : (
        <>
          <section className="ai-news-status">
            <strong>过去 7 天机会已同步</strong>
            <span>
              {data.start_date} 至 {data.end_date}
            </span>
            <span>来源 {detail.sourceCount}</span>
            <span>机会 {detail.opportunityCount}</span>
          </section>
          <article className="xiaod-report">
            <section className="xiaod-hero">
              <span>01 本周搞钱判断</span>
              <h2>{data.money_judgment}</h2>
              <p>{data.summary}</p>
            </section>
            <section>
              <h2>02 行业机会雷达</h2>
              <div className="xiaod-grid">
                {data.radar_items.map((item) => (
                  <article className="xiaod-card" key={item.id}>
                    <span>{item.industry}</span>
                    <h3>{item.title}</h3>
                    <p>{item.what_happened}</p>
                    <strong>商业判断</strong>
                    <p>{item.business_judgment}</p>
                    <strong>省时间</strong>
                    <p>{String(item.time_saved ?? "公开信息未披露")}</p>
                    <strong>多赚钱</strong>
                    <p>{String(item.more_money ?? "公开信息未披露")}</p>
                    <strong>立即行动</strong>
                    <p>{item.immediate_action}</p>
                    {item.matched_terms.length ? (
                      <p>
                        必追词：
                        {item.matched_terms.map((term) => (
                          <b key={term}>{term} </b>
                        ))}
                      </p>
                    ) : null}
                    <a href={item.evidence.url} target="_blank" rel="noreferrer">
                      查看原始来源
                    </a>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>03 落地案例</h2>
              <div className="xiaod-grid">
                {data.case_studies.map((item, index) => (
                  <article className="xiaod-card" key={index}>
                    <h3>{String(item.title ?? "案例")}</h3>
                    <p>{String(item.scenario ?? "公开信息未披露")}</p>
                    <p>
                      <strong>付费方：</strong>
                      {String(item.payer ?? "公开信息未披露")}
                    </p>
                    <p>
                      <strong>风险：</strong>
                      {String(item.risks ?? "公开信息未披露")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>04 本周销售素材</h2>
              <div className="xiaod-card">
                <p>
                  <strong>朋友圈：</strong>
                  {String(data.sales_kit.moments_copy ?? "")}
                </p>
                <p>
                  <strong>私聊：</strong>
                  {String(data.sales_kit.private_message ?? "")}
                </p>
                <p>
                  <strong>跟进：</strong>
                  {String(data.sales_kit.follow_up ?? "")}
                </p>
              </div>
            </section>
            <section>
              <h2>05 副业灵感池</h2>
              <div className="xiaod-grid">
                {data.side_hustles.map((item) => (
                  <article className="xiaod-card" key={item.id}>
                    <span>{item.industry}</span>
                    <h3>{item.title}</h3>
                    <p>
                      <strong>抄作业对象：</strong>
                      {item.copy_target}
                    </p>
                    <p>{item.payment_reason}</p>
                    <p>
                      <strong>落地简化：</strong>
                      准备 {item.materials.join("、")}，按 {item.first_steps.join("；")} 执行。
                    </p>
                    <p>
                      <strong>难度：</strong>
                      {item.difficulty} · <strong>离钱：</strong>
                      {item.money_distance}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>06 本周副业优先排序</h2>
              <ol className="xiaod-ranking">
                {data.ranking.map((item) => (
                  <li key={item.opportunity_id}>
                    <strong>
                      TOP {item.rank} · {item.title}
                    </strong>
                    <span>
                      上手难度 {item.difficulty} · 离钱距离 {item.money_distance}
                    </span>
                    <p>{item.reason}</p>
                  </li>
                ))}
              </ol>
              {recommended ? (
                <div className="xiaod-recommendation">
                  <span>本周只推荐</span>
                  <h3>{recommended.title}</h3>
                  <p>{recommended.payment_reason}</p>
                </div>
              ) : (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    本周没有同时满足“上手难度低、离钱近”的机会，因此不作强行推荐。
                  </MessageBarBody>
                </MessageBar>
              )}
            </section>
          </article>
        </>
      )}
    </div>
  );
}
