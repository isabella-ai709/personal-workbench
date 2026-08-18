import { randomUUID } from "node:crypto";

import type {
  BusinessAiDraft,
  BusinessActivity,
  Company,
  Contact,
  CreateActivityInput,
  FollowUp,
  Opportunity,
  OpportunityStage,
  Partnership,
  PartnershipStatus,
  UpdateCompanyInput,
  UpdateContactInput,
  UpdateOpportunityInput,
  UpdatePartnershipInput,
} from "../../../shared/business-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { WorkbenchDatabase } from "../../db/connection";

type Row = Record<string, string | number | null>;

function tags(value: string | number | null): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function company(row: Row): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: String(row.short_name),
    industry: String(row.industry),
    region: String(row.region),
    website: String(row.website),
    source: String(row.source),
    tags: tags(row.tags_json),
    relationshipStatus: row.relationship_status as Company["relationshipStatus"],
    owner: String(row.owner),
    notes: String(row.notes),
    lastContactAt: row.last_contact_at as string | null,
    nextFollowUpAt: row.next_follow_up_at as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at as string | null,
  };
}

function contact(row: Row): Contact {
  return {
    id: String(row.id),
    companyId: row.company_id as string | null,
    name: String(row.name),
    title: String(row.title),
    department: String(row.department),
    phone: String(row.phone),
    wechat: String(row.wechat),
    email: String(row.email),
    decisionRole: row.decision_role as Contact["decisionRole"],
    relationshipLevel: Number(row.relationship_level),
    preferences: String(row.preferences),
    tags: tags(row.tags_json),
    notes: String(row.notes),
    lastContactAt: row.last_contact_at as string | null,
    nextFollowUpAt: row.next_follow_up_at as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at as string | null,
  };
}

function opportunity(row: Row): Opportunity {
  return {
    id: String(row.id),
    companyId: row.company_id as string | null,
    primaryContactId: row.primary_contact_id as string | null,
    name: String(row.name),
    stage: row.stage as OpportunityStage,
    needs: String(row.needs),
    offering: String(row.offering),
    amountMinor: row.amount_minor === null ? null : Number(row.amount_minor),
    currency: String(row.currency),
    probability: Number(row.probability),
    expectedCloseAt: row.expected_close_at as string | null,
    source: String(row.source),
    competition: String(row.competition),
    risks: String(row.risks),
    owner: String(row.owner),
    resultSummary: String(row.result_summary),
    lossReason: String(row.loss_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at as string | null,
  };
}

function partnership(row: Row): Partnership {
  return {
    id: String(row.id),
    companyId: row.company_id as string | null,
    primaryContactId: row.primary_contact_id as string | null,
    linkedOpportunityId: row.linked_opportunity_id as string | null,
    name: String(row.name),
    type: String(row.type),
    status: row.status as PartnershipStatus,
    objective: String(row.objective),
    proposalSummary: String(row.proposal_summary),
    contributions: String(row.contributions),
    expectedOutcome: String(row.expected_outcome),
    risks: String(row.risks),
    owner: String(row.owner),
    startAt: row.start_at as string | null,
    targetEndAt: row.target_end_at as string | null,
    resultSummary: String(row.result_summary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at as string | null,
  };
}

function activity(row: Row): BusinessActivity {
  return {
    id: String(row.id),
    type: row.type as BusinessActivity["type"],
    occurredAt: String(row.occurred_at),
    participants: String(row.participants),
    rawContent: String(row.raw_content),
    summary: String(row.summary),
    sourceType: row.source_type as BusinessActivity["sourceType"],
    companyId: row.company_id as string | null,
    contactId: row.contact_id as string | null,
    opportunityId: row.opportunity_id as string | null,
    partnershipId: row.partnership_id as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function followUp(row: Row): FollowUp {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    dueAt: String(row.due_at),
    priority: row.priority as FollowUp["priority"],
    status: row.status as FollowUp["status"],
    owner: String(row.owner),
    sourceActivityId: row.source_activity_id as string | null,
    companyId: row.company_id as string | null,
    contactId: row.contact_id as string | null,
    opportunityId: row.opportunity_id as string | null,
    partnershipId: row.partnership_id as string | null,
    completedAt: row.completed_at as string | null,
    completionNote: String(row.completion_note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function notFound(label: string): never {
  throw new WorkbenchError("NOT_FOUND", `${label}不存在`, 404);
}

function conflict(error: unknown, message: string): never {
  if (error instanceof Error && /constraint failed/i.test(error.message)) {
    throw new WorkbenchError("CONFLICT", message, 409);
  }
  throw error;
}

export class BusinessRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  listCompanies(search = "", includeDeleted = false): Company[] {
    const term = `%${search}%`;
    return (
      this.database
        .prepare(
          `SELECT * FROM business_companies
           WHERE (? = '' OR name LIKE ? OR short_name LIKE ? OR industry LIKE ? OR tags_json LIKE ?)
             AND (? = 1 OR deleted_at IS NULL)
           ORDER BY updated_at DESC, id DESC`,
        )
        .all(search, term, term, term, term, includeDeleted ? 1 : 0) as unknown as Row[]
    ).map(company);
  }

  getCompany(id: string, includeDeleted = false): Company {
    const row = this.database
      .prepare(
        `SELECT * FROM business_companies WHERE id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`,
      )
      .get(id) as Row | undefined;
    return row ? company(row) : notFound("公司");
  }

  createCompany(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createCompanyInputSchema.parse
    >,
  ): Company {
    const id = randomUUID();
    const now = this.now();
    try {
      this.database
        .prepare(
          `INSERT INTO business_companies
           (id,name,short_name,industry,region,website,source,tags_json,relationship_status,owner,notes,last_contact_at,next_follow_up_at,created_at,updated_at,deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
        )
        .run(
          id,
          input.name,
          input.shortName,
          input.industry,
          input.region,
          input.website,
          input.source,
          JSON.stringify(input.tags),
          input.relationshipStatus,
          input.owner,
          input.notes,
          null,
          input.nextFollowUpAt,
          now,
          now,
        );
    } catch (error) {
      conflict(error, "已有同名的有效公司");
    }
    return this.getCompany(id);
  }

  updateCompany(id: string, input: UpdateCompanyInput): Company {
    const current = this.getCompany(id);
    const next = { ...current, ...input };
    try {
      this.database
        .prepare(
          `UPDATE business_companies SET name=?,short_name=?,industry=?,region=?,website=?,source=?,tags_json=?,relationship_status=?,owner=?,notes=?,next_follow_up_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`,
        )
        .run(
          next.name,
          next.shortName,
          next.industry,
          next.region,
          next.website,
          next.source,
          JSON.stringify(next.tags),
          next.relationshipStatus,
          next.owner,
          next.notes,
          next.nextFollowUpAt,
          this.now(),
          id,
        );
    } catch (error) {
      conflict(error, "已有同名的有效公司");
    }
    return this.getCompany(id);
  }

  deleteCompany(id: string): Company {
    const active = this.database
      .prepare(
        `SELECT (SELECT COUNT(*) FROM business_opportunities WHERE company_id=? AND deleted_at IS NULL AND stage NOT IN ('won','lost')) + (SELECT COUNT(*) FROM business_partnerships WHERE company_id=? AND deleted_at IS NULL AND status NOT IN ('completed','terminated')) AS count`,
      )
      .get(id, id) as { count: number };
    if (active.count > 0)
      throw new WorkbenchError("CONFLICT", "该公司仍有关联的进行中机会或合作项目", 409);
    const now = this.now();
    const result = this.database
      .prepare(
        "UPDATE business_companies SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
      )
      .run(now, now, id);
    if (!result.changes) notFound("公司");
    return this.getCompany(id, true);
  }

  restoreCompany(id: string): Company {
    try {
      const result = this.database
        .prepare(
          "UPDATE business_companies SET deleted_at=NULL,updated_at=? WHERE id=? AND deleted_at IS NOT NULL",
        )
        .run(this.now(), id);
      if (!result.changes) notFound("已删除公司");
    } catch (error) {
      conflict(error, "同名公司阻止了恢复");
    }
    return this.getCompany(id);
  }

  listContacts(search = "", includeDeleted = false): Contact[] {
    const term = `%${search}%`;
    return (
      this.database
        .prepare(
          `SELECT * FROM business_contacts WHERE (?='' OR name LIKE ? OR title LIKE ? OR phone LIKE ? OR wechat LIKE ? OR email LIKE ?) AND (?=1 OR deleted_at IS NULL) ORDER BY updated_at DESC,id DESC`,
        )
        .all(search, term, term, term, term, term, includeDeleted ? 1 : 0) as unknown as Row[]
    ).map(contact);
  }

  getContact(id: string, includeDeleted = false): Contact {
    const row = this.database
      .prepare(
        `SELECT * FROM business_contacts WHERE id=? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`,
      )
      .get(id) as Row | undefined;
    return row ? contact(row) : notFound("联系人");
  }

  createContact(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createContactInputSchema.parse
    >,
  ): Contact {
    const id = randomUUID();
    const now = this.now();
    this.database
      .prepare(
        `INSERT INTO business_contacts (id,company_id,name,title,department,phone,wechat,email,decision_role,relationship_level,preferences,tags_json,notes,last_contact_at,next_follow_up_at,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      )
      .run(
        id,
        input.companyId,
        input.name,
        input.title,
        input.department,
        input.phone,
        input.wechat,
        input.email,
        input.decisionRole,
        input.relationshipLevel,
        input.preferences,
        JSON.stringify(input.tags),
        input.notes,
        null,
        input.nextFollowUpAt,
        now,
        now,
      );
    return this.getContact(id);
  }

  updateContact(id: string, input: UpdateContactInput): Contact {
    const next = { ...this.getContact(id), ...input };
    this.database
      .prepare(
        `UPDATE business_contacts SET company_id=?,name=?,title=?,department=?,phone=?,wechat=?,email=?,decision_role=?,relationship_level=?,preferences=?,tags_json=?,notes=?,next_follow_up_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`,
      )
      .run(
        next.companyId,
        next.name,
        next.title,
        next.department,
        next.phone,
        next.wechat,
        next.email,
        next.decisionRole,
        next.relationshipLevel,
        next.preferences,
        JSON.stringify(next.tags),
        next.notes,
        next.nextFollowUpAt,
        this.now(),
        id,
      );
    return this.getContact(id);
  }

  deleteContact(id: string): Contact {
    const now = this.now();
    const result = this.database
      .prepare(
        "UPDATE business_contacts SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
      )
      .run(now, now, id);
    if (!result.changes) notFound("联系人");
    return this.getContact(id, true);
  }

  restoreContact(id: string): Contact {
    const result = this.database
      .prepare(
        "UPDATE business_contacts SET deleted_at=NULL,updated_at=? WHERE id=? AND deleted_at IS NOT NULL",
      )
      .run(this.now(), id);
    if (!result.changes) notFound("已删除联系人");
    return this.getContact(id);
  }

  listOpportunities(search = ""): Opportunity[] {
    const term = `%${search}%`;
    return (
      this.database
        .prepare(
          "SELECT * FROM business_opportunities WHERE deleted_at IS NULL AND (?='' OR name LIKE ? OR needs LIKE ? OR offering LIKE ?) ORDER BY updated_at DESC,id DESC",
        )
        .all(search, term, term, term) as unknown as Row[]
    ).map(opportunity);
  }

  getOpportunity(id: string): Opportunity {
    const row = this.database
      .prepare("SELECT * FROM business_opportunities WHERE id=? AND deleted_at IS NULL")
      .get(id) as Row | undefined;
    return row ? opportunity(row) : notFound("销售机会");
  }

  createOpportunity(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createOpportunityInputSchema.parse
    >,
  ): Opportunity {
    const id = randomUUID();
    const now = this.now();
    this.database
      .prepare(
        `INSERT INTO business_opportunities (id,company_id,primary_contact_id,name,stage,needs,offering,amount_minor,currency,probability,expected_close_at,source,competition,risks,owner,result_summary,loss_reason,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      )
      .run(
        id,
        input.companyId,
        input.primaryContactId,
        input.name,
        input.stage,
        input.needs,
        input.offering,
        input.amountMinor,
        input.currency,
        input.probability,
        input.expectedCloseAt,
        input.source,
        input.competition,
        input.risks,
        input.owner,
        "",
        "",
        now,
        now,
      );
    return this.getOpportunity(id);
  }

  updateOpportunity(id: string, input: UpdateOpportunityInput): Opportunity {
    const next = { ...this.getOpportunity(id), ...input };
    this.database
      .prepare(
        `UPDATE business_opportunities SET company_id=?,primary_contact_id=?,name=?,needs=?,offering=?,amount_minor=?,currency=?,probability=?,expected_close_at=?,source=?,competition=?,risks=?,owner=?,updated_at=? WHERE id=? AND deleted_at IS NULL`,
      )
      .run(
        next.companyId,
        next.primaryContactId,
        next.name,
        next.needs,
        next.offering,
        next.amountMinor,
        next.currency,
        next.probability,
        next.expectedCloseAt,
        next.source,
        next.competition,
        next.risks,
        next.owner,
        this.now(),
        id,
      );
    return this.getOpportunity(id);
  }

  setOpportunityStage(
    id: string,
    stage: OpportunityStage,
    resultSummary: string,
    lossReason: string,
    reason: string,
  ): Opportunity {
    const current = this.getOpportunity(id);
    const now = this.now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "UPDATE business_opportunities SET stage=?,result_summary=?,loss_reason=?,updated_at=? WHERE id=?",
        )
        .run(stage, resultSummary, lossReason, now, id);
      this.database
        .prepare(
          "INSERT INTO business_events(id,entity_type,entity_id,event_type,from_value,to_value,reason,created_at) VALUES (?, 'opportunity', ?, 'stage_changed', ?, ?, ?, ?)",
        )
        .run(randomUUID(), id, current.stage, stage, reason, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getOpportunity(id);
  }

  listPartnerships(search = ""): Partnership[] {
    const term = `%${search}%`;
    return (
      this.database
        .prepare(
          "SELECT * FROM business_partnerships WHERE deleted_at IS NULL AND (?='' OR name LIKE ? OR type LIKE ? OR objective LIKE ?) ORDER BY updated_at DESC,id DESC",
        )
        .all(search, term, term, term) as unknown as Row[]
    ).map(partnership);
  }
  getPartnership(id: string): Partnership {
    const row = this.database
      .prepare("SELECT * FROM business_partnerships WHERE id=? AND deleted_at IS NULL")
      .get(id) as Row | undefined;
    return row ? partnership(row) : notFound("合作项目");
  }
  createPartnership(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createPartnershipInputSchema.parse
    >,
  ): Partnership {
    const id = randomUUID();
    const now = this.now();
    this.database
      .prepare(
        `INSERT INTO business_partnerships(id,company_id,primary_contact_id,linked_opportunity_id,name,type,status,objective,proposal_summary,contributions,expected_outcome,risks,owner,start_at,target_end_at,result_summary,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      )
      .run(
        id,
        input.companyId,
        input.primaryContactId,
        input.linkedOpportunityId,
        input.name,
        input.type,
        input.status,
        input.objective,
        input.proposalSummary,
        input.contributions,
        input.expectedOutcome,
        input.risks,
        input.owner,
        input.startAt,
        input.targetEndAt,
        "",
        now,
        now,
      );
    return this.getPartnership(id);
  }
  updatePartnership(id: string, input: UpdatePartnershipInput): Partnership {
    const next = { ...this.getPartnership(id), ...input };
    this.database
      .prepare(
        `UPDATE business_partnerships SET company_id=?,primary_contact_id=?,linked_opportunity_id=?,name=?,type=?,objective=?,proposal_summary=?,contributions=?,expected_outcome=?,risks=?,owner=?,start_at=?,target_end_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`,
      )
      .run(
        next.companyId,
        next.primaryContactId,
        next.linkedOpportunityId,
        next.name,
        next.type,
        next.objective,
        next.proposalSummary,
        next.contributions,
        next.expectedOutcome,
        next.risks,
        next.owner,
        next.startAt,
        next.targetEndAt,
        this.now(),
        id,
      );
    return this.getPartnership(id);
  }
  setPartnershipStatus(
    id: string,
    status: PartnershipStatus,
    resultSummary: string,
    reason: string,
  ): Partnership {
    const current = this.getPartnership(id);
    const now = this.now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "UPDATE business_partnerships SET status=?,result_summary=?,updated_at=? WHERE id=?",
        )
        .run(status, resultSummary, now, id);
      this.database
        .prepare(
          "INSERT INTO business_events(id,entity_type,entity_id,event_type,from_value,to_value,reason,created_at) VALUES (?, 'partnership', ?, 'status_changed', ?, ?, ?, ?)",
        )
        .run(randomUUID(), id, current.status, status, reason, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getPartnership(id);
  }

  createActivity(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createActivityInputSchema.parse
    >,
    sourceType: BusinessActivity["sourceType"] = "manual",
    idempotencyKey?: string,
  ): BusinessActivity {
    if (idempotencyKey) {
      const existing = this.database
        .prepare("SELECT * FROM business_activities WHERE idempotency_key=?")
        .get(idempotencyKey) as Row | undefined;
      if (existing) return activity(existing);
    }
    const id = randomUUID();
    const now = this.now();
    try {
      this.database
        .prepare(
          `INSERT INTO business_activities(id,type,occurred_at,participants,raw_content,summary,source_type,company_id,contact_id,opportunity_id,partnership_id,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.type,
          input.occurredAt,
          input.participants,
          input.rawContent,
          input.summary,
          sourceType,
          input.companyId,
          input.contactId,
          input.opportunityId,
          input.partnershipId,
          idempotencyKey ?? null,
          now,
          now,
        );
      this.touchLastContact(input, input.occurredAt);
    } catch (error) {
      conflict(error, "商务活动重复或关联无效");
    }
    return this.getActivity(id);
  }
  private touchLastContact(
    input: Pick<CreateActivityInput, "companyId" | "contactId">,
    occurredAt: string,
  ) {
    if (input.companyId)
      this.database
        .prepare(
          "UPDATE business_companies SET last_contact_at=MAX(COALESCE(last_contact_at,''),?),updated_at=? WHERE id=?",
        )
        .run(occurredAt, this.now(), input.companyId);
    if (input.contactId)
      this.database
        .prepare(
          "UPDATE business_contacts SET last_contact_at=MAX(COALESCE(last_contact_at,''),?),updated_at=? WHERE id=?",
        )
        .run(occurredAt, this.now(), input.contactId);
  }
  getActivity(id: string): BusinessActivity {
    const row = this.database.prepare("SELECT * FROM business_activities WHERE id=?").get(id) as
      Row | undefined;
    return row ? activity(row) : notFound("商务活动");
  }
  listActivities(
    filters: {
      companyId?: string;
      contactId?: string;
      opportunityId?: string;
      partnershipId?: string;
      limit?: number;
    } = {},
  ): BusinessActivity[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM business_activities WHERE (? IS NULL OR company_id=?) AND (? IS NULL OR contact_id=?) AND (? IS NULL OR opportunity_id=?) AND (? IS NULL OR partnership_id=?) ORDER BY occurred_at DESC,id DESC LIMIT ?`,
        )
        .all(
          filters.companyId ?? null,
          filters.companyId ?? null,
          filters.contactId ?? null,
          filters.contactId ?? null,
          filters.opportunityId ?? null,
          filters.opportunityId ?? null,
          filters.partnershipId ?? null,
          filters.partnershipId ?? null,
          filters.limit ?? 100,
        ) as unknown as Row[]
    ).map(activity);
  }

  createFollowUp(
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createFollowUpInputSchema.parse
    >,
  ): FollowUp {
    const id = randomUUID();
    const now = this.now();
    this.database
      .prepare(
        `INSERT INTO business_follow_ups(id,title,description,due_at,priority,status,owner,source_activity_id,company_id,contact_id,opportunity_id,partnership_id,completed_at,completion_note,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?,?,?,NULL,'',?,?)`,
      )
      .run(
        id,
        input.title,
        input.description,
        input.dueAt,
        input.priority,
        input.owner,
        input.sourceActivityId,
        input.companyId,
        input.contactId,
        input.opportunityId,
        input.partnershipId,
        now,
        now,
      );
    return this.getFollowUp(id);
  }
  getFollowUp(id: string): FollowUp {
    const row = this.database.prepare("SELECT * FROM business_follow_ups WHERE id=?").get(id) as
      Row | undefined;
    return row ? followUp(row) : notFound("跟进事项");
  }
  listFollowUps(status?: FollowUp["status"]): FollowUp[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM business_follow_ups WHERE (? IS NULL OR status=?) ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,due_at ASC,id ASC",
        )
        .all(status ?? null, status ?? null) as unknown as Row[]
    ).map(followUp);
  }
  updateFollowUpStatus(id: string, status: FollowUp["status"], completionNote = ""): FollowUp {
    const current = this.getFollowUp(id);
    const now = this.now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "UPDATE business_follow_ups SET status=?,completed_at=?,completion_note=?,updated_at=? WHERE id=?",
        )
        .run(status, status === "completed" ? now : null, completionNote, now, id);
      this.database
        .prepare(
          "INSERT INTO business_events(id,entity_type,entity_id,event_type,from_value,to_value,reason,created_at) VALUES (?, 'follow_up', ?, 'status_changed', ?, ?, ?, ?)",
        )
        .run(randomUUID(), id, current.status, status, completionNote, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getFollowUp(id);
  }
  rescheduleFollowUp(id: string, dueAt: string, reason: string): FollowUp {
    const current = this.getFollowUp(id);
    const now = this.now();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare("UPDATE business_follow_ups SET due_at=?,updated_at=? WHERE id=?")
        .run(dueAt, now, id);
      this.database
        .prepare(
          "INSERT INTO business_events(id,entity_type,entity_id,event_type,from_value,to_value,reason,created_at) VALUES (?, 'follow_up', ?, 'rescheduled', ?, ?, ?, ?)",
        )
        .run(randomUUID(), id, current.dueAt, dueAt, reason, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.getFollowUp(id);
  }

  getCounts() {
    return {
      companies: Number(
        (
          this.database
            .prepare("SELECT COUNT(*) AS count FROM business_companies WHERE deleted_at IS NULL")
            .get() as { count: number }
        ).count,
      ),
      contacts: Number(
        (
          this.database
            .prepare("SELECT COUNT(*) AS count FROM business_contacts WHERE deleted_at IS NULL")
            .get() as { count: number }
        ).count,
      ),
    };
  }
  getOpportunitySummary() {
    const rows = this.database
      .prepare(
        "SELECT stage,COUNT(*) AS count,COALESCE(SUM(amount_minor),0) AS amount FROM business_opportunities WHERE deleted_at IS NULL GROUP BY stage",
      )
      .all() as Array<{ stage: OpportunityStage; count: number; amount: number }>;
    return rows;
  }
  countActivePartnerships() {
    return Number(
      (
        this.database
          .prepare(
            "SELECT COUNT(*) AS count FROM business_partnerships WHERE deleted_at IS NULL AND status NOT IN ('completed','terminated')",
          )
          .get() as { count: number }
      ).count,
    );
  }

  createAiDraft(
    result: Omit<BusinessAiDraft, "id" | "status" | "createdAt" | "confirmedAt" | "rawContent">,
    rawContent: string,
  ): BusinessAiDraft {
    const id = randomUUID();
    const createdAt = this.now();
    this.database
      .prepare(
        "INSERT INTO business_ai_drafts(id,status,raw_content,result_json,idempotency_key,created_at,confirmed_at) VALUES (?, 'draft', ?, ?, NULL, ?, NULL)",
      )
      .run(id, rawContent, JSON.stringify(result), createdAt);
    return this.getAiDraft(id);
  }

  getAiDraft(id: string): BusinessAiDraft {
    const row = this.database.prepare("SELECT * FROM business_ai_drafts WHERE id=?").get(id) as
      Row | undefined;
    if (!row) return notFound("AI 草稿");
    const result = JSON.parse(String(row.result_json)) as Omit<
      BusinessAiDraft,
      "id" | "status" | "createdAt" | "confirmedAt" | "rawContent"
    >;
    return {
      id: String(row.id),
      status: row.status as BusinessAiDraft["status"],
      rawContent: String(row.raw_content),
      ...result,
      createdAt: String(row.created_at),
      confirmedAt: row.confirmed_at as string | null,
    };
  }

  confirmAiDraft(
    draftId: string,
    input: ReturnType<
      typeof import("../../../shared/business-contracts").createActivityInputSchema.parse
    >,
    followUps: Array<
      ReturnType<
        typeof import("../../../shared/business-contracts").createFollowUpInputSchema.parse
      >
    >,
    idempotencyKey: string,
  ): { activity: BusinessActivity; followUps: FollowUp[] } {
    const draft = this.getAiDraft(draftId);
    const activityKey = `ai:${draftId}:${idempotencyKey}`;
    const existing = this.database
      .prepare("SELECT * FROM business_activities WHERE idempotency_key=?")
      .get(activityKey) as Row | undefined;
    if (existing) {
      const savedActivity = activity(existing);
      return {
        activity: savedActivity,
        followUps: this.listFollowUps().filter(
          (item) => item.sourceActivityId === savedActivity.id,
        ),
      };
    }
    if (draft.status === "confirmed") {
      throw new WorkbenchError("CONFLICT", "该 AI 草稿已经确认", 409);
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const savedActivity = this.createActivity(input, "ai_confirmed", activityKey);
      const savedFollowUps = followUps.map((item) =>
        this.createFollowUp({ ...item, sourceActivityId: savedActivity.id }),
      );
      const confirmedAt = this.now();
      this.database
        .prepare(
          "UPDATE business_ai_drafts SET status='confirmed',idempotency_key=?,confirmed_at=? WHERE id=? AND status='draft'",
        )
        .run(idempotencyKey, confirmedAt, draftId);
      this.database.exec("COMMIT");
      return { activity: savedActivity, followUps: savedFollowUps };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
