import type { DashboardSummary } from "../../../shared/contracts";
import type { SkillService } from "../skills/skill-service";
import type { TaskPlanService } from "../task-plans/task-plan-service";

export class DashboardService {
  constructor(
    private readonly taskPlans: TaskPlanService,
    private readonly skills: SkillService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const taskPlanSummary = this.taskPlans.getDashboardSummary();
    const skills = await this.skills.list();
    return {
      ...taskPlanSummary,
      skills: {
        total: skills.length,
        enabled: skills.filter((skill) => skill.enabled).length,
        stale: skills.some((skill) => skill.stale),
      },
    };
  }
}
