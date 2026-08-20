import type { AiNewsEvent, AiNewsReport } from "../../../shared/ai-news-contracts";

const sectionLinks = [
  ["ai-news-judgment", "本周判断"],
  ["ai-news-top", "核心热点"],
  ["ai-news-products", "产品动态"],
  ["ai-news-tools", "工具与开源"],
  ["ai-news-business", "商业机会"],
  ["ai-news-trends", "趋势信号"],
  ["ai-news-watch", "下周观察"],
] as const;

export function WeeklyReportReader({ report }: { report: AiNewsReport }) {
  return (
    <div className="ai-news-reader">
      <nav className="ai-news-toc" aria-label="周报目录">
        <span>本期目录</span>
        {sectionLinks.map(([id, label], index) => (
          <a key={id} href={`#${id}`} className={index === 0 ? "active" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <article className="ai-news-report">
        <header className="ai-news-report-header">
          <span>
            AI HOTSPOT WEEKLY · {report.year} W{String(report.week).padStart(2, "0")}
          </span>
          <h2>{report.title}</h2>
          <p>{report.summary}</p>
        </header>

        <section id="ai-news-judgment" className="ai-news-judgment">
          <div aria-hidden="true" />
          <p>
            <small>如果这一周只能记住一件事</small>
            <strong>{report.weekly_judgment}</strong>
          </p>
        </section>

        <EventSection id="ai-news-top" title="核心热点" events={report.top_events} />
        <EventSection id="ai-news-products" title="产品动态" events={report.product_events} />
        <EventSection
          id="ai-news-tools"
          title="工具与开源"
          events={[...report.tool_events, ...report.open_source_events]}
        />

        <section id="ai-news-business" className="ai-news-section">
          <SectionHeading title="商业机会" count={report.business_opportunities.length} />
          {report.business_opportunities.length ? (
            <div className="ai-news-opportunities">
              {report.business_opportunities.map((item) => (
                <article key={`${item.title}-${item.offer}`}>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  <dl>
                    <div>
                      <dt>付费方</dt>
                      <dd>{item.payer}</dd>
                    </div>
                    <div>
                      <dt>可提供</dt>
                      <dd>{item.offer}</dd>
                    </div>
                    <div>
                      <dt>MVP</dt>
                      <dd>{item.mvp}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <EmptySection />
          )}
        </section>

        <section id="ai-news-trends" className="ai-news-section">
          <SectionHeading title="趋势信号" count={report.trend_signals.length} />
          {report.trend_signals.length ? (
            <div className="ai-news-trends">
              {report.trend_signals.map((trend) => (
                <article key={trend.title}>
                  <h4>{trend.title}</h4>
                  <p>{trend.judgment}</p>
                  {trend.evidence.length ? (
                    <ul>
                      {trend.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptySection />
          )}
        </section>

        <section id="ai-news-watch" className="ai-news-watch">
          <h3>下周观察</h3>
          {report.next_week_watch.length ? (
            <ul>
              {report.next_week_watch.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>本期没有新增观察项。</p>
          )}
        </section>
      </article>
    </div>
  );
}

function EventSection({ id, title, events }: { id: string; title: string; events: AiNewsEvent[] }) {
  return (
    <section id={id} className="ai-news-section">
      <SectionHeading title={title} count={events.length} />
      {events.length ? (
        events.map((event, index) => (
          <article className="ai-news-event" key={event.id}>
            <span className="ai-news-event-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <div className="ai-news-event-title">
                <h4>{event.title}</h4>
                <span>热度 {event.hot_score}</span>
              </div>
              <div className="ai-news-event-meta">
                <strong>{event.importance}</strong>
                <span>{event.category}</span>
                <span>{event.main_source}</span>
                <span>{event.source_grade}级信源</span>
              </div>
              <p>{event.summary}</p>
              {event.why_important || event.impact_for_people ? (
                <div className="ai-news-insights">
                  {event.why_important ? (
                    <div>
                      <small>为什么重要</small>
                      <span>{event.why_important}</span>
                    </div>
                  ) : null}
                  {event.impact_for_people ? (
                    <div>
                      <small>对我的影响</small>
                      <span>{event.impact_for_people}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <a href={event.main_url} target="_blank" rel="noreferrer">
                阅读原始来源
              </a>
            </div>
          </article>
        ))
      ) : (
        <EmptySection />
      )}
    </section>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="ai-news-section-heading">
      <h3>{title}</h3>
      <span>{count} 条</span>
    </div>
  );
}

function EmptySection() {
  return <p className="ai-news-section-empty">本期没有收录相关内容。</p>;
}
