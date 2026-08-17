import type { DashboardSummary } from "../../../shared/contracts";
import type { SkillService } from "../skills/skill-service";
import type { TaskRepository } from "../tasks/task-repository";

export class DashboardService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly skills: SkillService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const taskStatistics = this.tasks.getStatistics();
    const skills = await this.skills.list();
    return {
      tasks: taskStatistics,
      skills: {
        total: skills.length,
        enabled: skills.filter((skill) => skill.enabled).length,
        stale: skills.some((skill) => skill.stale),
      },
      recentRuns: this.tasks.listRecentRuns(5),
    };
  }
}
