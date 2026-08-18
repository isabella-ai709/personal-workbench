import {
  createActivityInputSchema,
  createCompanyInputSchema,
  createContactInputSchema,
  createFollowUpInputSchema,
  createOpportunityInputSchema,
  createPartnershipInputSchema,
  type Company,
  type Contact,
  type FollowUp,
  type Opportunity,
  type OpportunityStage,
  type Partnership,
  type PartnershipStatus,
  type UpdateCompanyInput,
  type UpdateContactInput,
  type UpdateOpportunityInput,
  type UpdatePartnershipInput,
} from "../../../shared/business-contracts";
import { WorkbenchError } from "../../../shared/errors";
import { BusinessRepository } from "./business-repository";

const opportunityTransitions: Record<OpportunityStage, OpportunityStage[]> = {
  lead: ["contacted", "lost"],
  contacted: ["lead", "needs_confirmed", "lost"],
  needs_confirmed: ["contacted", "proposal", "lost"],
  proposal: ["needs_confirmed", "negotiation", "lost"],
  negotiation: ["proposal", "won", "lost"],
  won: ["negotiation"],
  lost: ["lead", "contacted"],
};

const partnershipTransitions: Record<PartnershipStatus, PartnershipStatus[]> = {
  idea: ["contacting", "terminated", "paused"],
  contacting: ["idea", "proposal_confirmed", "terminated", "paused"],
  proposal_confirmed: ["contacting", "executing", "terminated", "paused"],
  executing: ["proposal_confirmed", "completed", "terminated", "paused"],
  completed: ["executing"],
  terminated: ["idea", "contacting"],
  paused: ["idea", "contacting", "proposal_confirmed", "executing", "terminated"],
};

export class BusinessService {
  constructor(
    private readonly repository: BusinessRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listCompanies(search = "", includeDeleted = false) {
    return this.repository.listCompanies(search, includeDeleted);
  }
  getCompany(id: string) {
    return this.repository.getCompany(id, true);
  }
  createCompany(input: unknown): { item: Company; possibleDuplicates: Company[] } {
    const parsed = createCompanyInputSchema.parse(input);
    const possibleDuplicates = this.repository
      .listCompanies(parsed.name)
      .filter((item) => item.name.toLocaleLowerCase() === parsed.name.toLocaleLowerCase());
    return { item: this.repository.createCompany(parsed), possibleDuplicates };
  }
  updateCompany(id: string, input: UpdateCompanyInput) {
    return this.repository.updateCompany(id, input);
  }
  deleteCompany(id: string) {
    return this.repository.deleteCompany(id);
  }
  restoreCompany(id: string) {
    return this.repository.restoreCompany(id);
  }

  listContacts(search = "", includeDeleted = false) {
    return this.repository.listContacts(search, includeDeleted);
  }
  getContact(id: string) {
    return this.repository.getContact(id, true);
  }
  createContact(input: unknown): { item: Contact; possibleDuplicates: Contact[] } {
    const parsed = createContactInputSchema.parse(input);
    const normalizedPhone = parsed.phone.replace(/\s+/g, "");
    const possibleDuplicates = this.repository
      .listContacts(parsed.name)
      .filter(
        (item) =>
          item.name.toLocaleLowerCase() === parsed.name.toLocaleLowerCase() ||
          (normalizedPhone && item.phone.replace(/\s+/g, "") === normalizedPhone) ||
          (parsed.email && item.email.toLocaleLowerCase() === parsed.email.toLocaleLowerCase()),
      );
    return { item: this.repository.createContact(parsed), possibleDuplicates };
  }
  updateContact(id: string, input: UpdateContactInput) {
    return this.repository.updateContact(id, input);
  }
  deleteContact(id: string) {
    return this.repository.deleteContact(id);
  }
  restoreContact(id: string) {
    return this.repository.restoreContact(id);
  }

  listOpportunities(search = "") {
    return this.repository.listOpportunities(search);
  }
  getOpportunity(id: string) {
    return this.repository.getOpportunity(id);
  }
  createOpportunity(input: unknown): Opportunity {
    return this.repository.createOpportunity(createOpportunityInputSchema.parse(input));
  }
  updateOpportunity(id: string, input: UpdateOpportunityInput): Opportunity {
    return this.repository.updateOpportunity(id, input);
  }
  changeOpportunityStage(
    id: string,
    stage: OpportunityStage,
    resultSummary = "",
    lossReason = "",
    reason = "",
  ): Opportunity {
    const current = this.repository.getOpportunity(id);
    if (!opportunityTransitions[current.stage].includes(stage)) {
      throw new WorkbenchError("INVALID_STATE", "销售机会不能直接切换到该阶段", 409);
    }
    if (["won", "lost"].includes(stage) && !resultSummary.trim()) {
      throw new WorkbenchError("VALIDATION_ERROR", "成交或流失时必须填写结果摘要", 400);
    }
    if (stage === "lost" && !lossReason.trim()) {
      throw new WorkbenchError("VALIDATION_ERROR", "标记流失时必须填写流失原因", 400);
    }
    if (["won", "lost"].includes(current.stage) && !reason.trim()) {
      throw new WorkbenchError("VALIDATION_ERROR", "重新开启终态机会时必须填写原因", 400);
    }
    return this.repository.setOpportunityStage(id, stage, resultSummary, lossReason, reason);
  }

  listPartnerships(search = "") {
    return this.repository.listPartnerships(search);
  }
  getPartnership(id: string) {
    return this.repository.getPartnership(id);
  }
  createPartnership(input: unknown): Partnership {
    return this.repository.createPartnership(createPartnershipInputSchema.parse(input));
  }
  updatePartnership(id: string, input: UpdatePartnershipInput): Partnership {
    return this.repository.updatePartnership(id, input);
  }
  changePartnershipStatus(
    id: string,
    status: PartnershipStatus,
    resultSummary = "",
    reason = "",
  ): Partnership {
    const current = this.repository.getPartnership(id);
    if (!partnershipTransitions[current.status].includes(status)) {
      throw new WorkbenchError("INVALID_STATE", "合作项目不能直接切换到该状态", 409);
    }
    if (["completed", "terminated"].includes(status) && !resultSummary.trim()) {
      throw new WorkbenchError("VALIDATION_ERROR", "完成或终止合作时必须填写结果摘要", 400);
    }
    if (["completed", "terminated"].includes(current.status) && !reason.trim()) {
      throw new WorkbenchError("VALIDATION_ERROR", "重新开启终态合作时必须填写原因", 400);
    }
    return this.repository.setPartnershipStatus(id, status, resultSummary, reason);
  }

  createActivity(input: unknown, idempotencyKey?: string) {
    return this.repository.createActivity(
      createActivityInputSchema.parse(input),
      "manual",
      idempotencyKey,
    );
  }
  listActivities(filters: Parameters<BusinessRepository["listActivities"]>[0]) {
    return this.repository.listActivities(filters);
  }
  createFollowUp(input: unknown): FollowUp {
    return this.repository.createFollowUp(createFollowUpInputSchema.parse(input));
  }
  listFollowUps(status?: FollowUp["status"]) {
    return this.repository.listFollowUps(status);
  }
  changeFollowUpStatus(id: string, status: FollowUp["status"], completionNote = "") {
    return this.repository.updateFollowUpStatus(id, status, completionNote);
  }
  rescheduleFollowUp(id: string, dueAt: string, reason: string) {
    return this.repository.rescheduleFollowUp(id, dueAt, reason);
  }

  getDashboard() {
    const now = this.now();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const nextSeven = new Date(start);
    nextSeven.setDate(nextSeven.getDate() + 8);
    const pending = this.repository.listFollowUps("pending");
    const summary = this.repository.getOpportunitySummary();
    const byStage = Object.fromEntries(
      (
        [
          "lead",
          "contacted",
          "needs_confirmed",
          "proposal",
          "negotiation",
          "won",
          "lost",
        ] as OpportunityStage[]
      ).map((stage) => [stage, 0]),
    ) as Record<OpportunityStage, number>;
    for (const item of summary) byStage[item.stage] = item.count;
    return {
      followUps: {
        dueToday: pending.filter(
          (item) => new Date(item.dueAt) >= start && new Date(item.dueAt) < end,
        ).length,
        overdue: pending.filter((item) => new Date(item.dueAt) < start).length,
        nextSevenDays: pending.filter(
          (item) => new Date(item.dueAt) >= end && new Date(item.dueAt) < nextSeven,
        ).length,
      },
      opportunities: {
        active: summary
          .filter((item) => !["won", "lost"].includes(item.stage))
          .reduce((sum, item) => sum + item.count, 0),
        amountMinor: summary
          .filter((item) => !["won", "lost"].includes(item.stage))
          .reduce((sum, item) => sum + item.amount, 0),
        byStage,
      },
      activePartnerships: this.repository.countActivePartnerships(),
      ...this.repository.getCounts(),
      recentActivities: this.repository.listActivities({ limit: 8 }),
    };
  }
}
