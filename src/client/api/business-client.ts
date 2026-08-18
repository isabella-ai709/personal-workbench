import {
  activitySchema,
  businessAiDraftSchema,
  businessDashboardSchema,
  companySchema,
  contactSchema,
  followUpSchema,
  opportunitySchema,
  partnershipSchema,
  type BusinessActivity,
  type Company,
  type Contact,
  type CreateActivityInput,
  type CreateCompanyInput,
  type CreateContactInput,
  type CreateFollowUpInput,
  type CreateOpportunityInput,
  type CreatePartnershipInput,
  type FollowUp,
  type OpportunityStage,
  type PartnershipStatus,
} from "../../shared/business-contracts";
import { apiRequest } from "./client";

function items<T>(payload: unknown, parse: (value: unknown) => T): T[] {
  return ((payload as { items?: unknown[] }).items ?? []).map(parse);
}

export const getBusinessDashboard = async () =>
  businessDashboardSchema.parse(await apiRequest("/api/business/dashboard"));
export const getCompanies = async () =>
  items(await apiRequest("/api/business/companies"), (value) => companySchema.parse(value));
export const getContacts = async () =>
  items(await apiRequest("/api/business/contacts"), (value) => contactSchema.parse(value));
export const getOpportunities = async () =>
  items(await apiRequest("/api/business/opportunities"), (value) => opportunitySchema.parse(value));
export const getPartnerships = async () =>
  items(await apiRequest("/api/business/partnerships"), (value) => partnershipSchema.parse(value));
export const getActivities = async () =>
  items(await apiRequest("/api/business/activities"), (value) => activitySchema.parse(value));
export const getFollowUps = async () =>
  items(await apiRequest("/api/business/follow-ups"), (value) => followUpSchema.parse(value));

export async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const payload = await apiRequest<{ item: unknown }>("/api/business/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return companySchema.parse(payload.item);
}
export async function createContact(input: CreateContactInput): Promise<Contact> {
  const payload = await apiRequest<{ item: unknown }>("/api/business/contacts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return contactSchema.parse(payload.item);
}
export async function createOpportunity(input: CreateOpportunityInput) {
  return opportunitySchema.parse(
    await apiRequest("/api/business/opportunities", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function createPartnership(input: CreatePartnershipInput) {
  return partnershipSchema.parse(
    await apiRequest("/api/business/partnerships", { method: "POST", body: JSON.stringify(input) }),
  );
}
export async function createActivity(input: CreateActivityInput): Promise<BusinessActivity> {
  return activitySchema.parse(
    await apiRequest("/api/business/activities", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  );
}
export async function createFollowUp(input: CreateFollowUpInput): Promise<FollowUp> {
  return followUpSchema.parse(
    await apiRequest("/api/business/follow-ups", { method: "POST", body: JSON.stringify(input) }),
  );
}
export async function changeOpportunityStage(
  id: string,
  input: { stage: OpportunityStage; resultSummary?: string; lossReason?: string; reason?: string },
) {
  return opportunitySchema.parse(
    await apiRequest(`/api/business/opportunities/${id}/stage`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function changePartnershipStatus(
  id: string,
  input: { status: PartnershipStatus; resultSummary?: string; reason?: string },
) {
  return partnershipSchema.parse(
    await apiRequest(`/api/business/partnerships/${id}/status`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function changeFollowUpStatus(id: string, status: FollowUp["status"]) {
  return followUpSchema.parse(
    await apiRequest(`/api/business/follow-ups/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  );
}
export async function generateAiDraft(rawContent: string) {
  return businessAiDraftSchema.parse(
    await apiRequest("/api/business/ai-drafts", {
      method: "POST",
      body: JSON.stringify({ rawContent }),
    }),
  );
}
export async function confirmAiDraft(
  id: string,
  input: { activity: CreateActivityInput; followUps: CreateFollowUpInput[] },
) {
  return apiRequest<{ activity: BusinessActivity; followUps: FollowUp[] }>(
    `/api/business/ai-drafts/${id}/confirm`,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );
}
