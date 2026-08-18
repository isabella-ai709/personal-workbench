import {
  createTaskPlanInputSchema,
  type TaskPlan,
  type TaskPlanStatus,
  updateTaskPlanInputSchema,
} from "../../../shared/task-plan-contracts";
import { getFocusGroup } from "../../../shared/task-plan-groups";
import type { TaskPlanRepository } from "./task-plan-repository";

export class TaskPlanService {
  constructor(
    private readonly repository: TaskPlanRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(includeDeleted = false): TaskPlan[] {
    return this.repository.list(includeDeleted);
  }

  get(id: string): TaskPlan {
    return this.repository.get(id);
  }

  create(input: unknown): TaskPlan {
    return this.repository.create(createTaskPlanInputSchema.parse(input));
  }

  update(id: string, input: unknown): TaskPlan {
    return this.repository.update(id, updateTaskPlanInputSchema.parse(input));
  }

  setStatus(id: string, status: TaskPlanStatus): TaskPlan {
    return this.repository.update(id, { status });
  }

  delete(id: string): TaskPlan {
    return this.repository.softDelete(id);
  }

  restore(id: string): TaskPlan {
    return this.repository.restore(id);
  }

  getDashboardSummary() {
    const plans = this.repository.list();
    const now = this.now();
    return {
      plans: {
        pastPlanTime: plans.filter((item) => getFocusGroup(item, now) === "past_plan_time").length,
        today: plans.filter((item) => getFocusGroup(item, now) === "today").length,
        inProgress: plans.filter((item) => item.type !== "idea" && item.status === "in_progress")
          .length,
        blocked: plans.filter((item) => item.type !== "idea" && item.status === "blocked").length,
      },
      recentIdeas: plans
        .filter((item) => item.type === "idea" && item.status !== "completed")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5),
    };
  }
}
