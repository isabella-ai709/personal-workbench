import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  businessListQuerySchema,
  followUpStatusSchema,
  opportunityStageSchema,
  partnershipStatusSchema,
  updateCompanyInputSchema,
  updateContactInputSchema,
  updateOpportunityInputSchema,
  updatePartnershipInputSchema,
} from "../../../shared/business-contracts";
import type { BusinessService } from "./business-service";
import type { BusinessAiService } from "./business-ai";

const idParams = z.object({ id: z.string().uuid() });
const searchQuery = businessListQuerySchema;
const activityQuery = z.object({
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  partnershipId: z.string().uuid().optional(),
});
const stageBody = z.object({
  stage: opportunityStageSchema,
  resultSummary: z.string().max(20_000).default(""),
  lossReason: z.string().max(20_000).default(""),
  reason: z.string().max(20_000).default(""),
});
const partnershipStatusBody = z.object({
  status: partnershipStatusSchema,
  resultSummary: z.string().max(20_000).default(""),
  reason: z.string().max(20_000).default(""),
});
const followUpListQuery = z.object({ status: followUpStatusSchema.optional() });
const followUpStatusBody = z.object({
  status: followUpStatusSchema,
  completionNote: z.string().max(20_000).default(""),
});
const rescheduleBody = z.object({
  dueAt: z.iso.datetime({ offset: true }),
  reason: z.string().max(20_000).default(""),
});

export function registerBusinessRoutes(
  app: FastifyInstance,
  service: BusinessService,
  aiService?: BusinessAiService,
): void {
  app.get("/api/business/dashboard", async () => service.getDashboard());

  app.get("/api/business/companies", async (request) => {
    const q = searchQuery.parse(request.query);
    return { items: service.listCompanies(q.search, q.includeDeleted) };
  });
  app.post("/api/business/companies", async (request, reply) =>
    reply.code(201).send(service.createCompany(request.body)),
  );
  app.get("/api/business/companies/:id", async (request) =>
    service.getCompany(idParams.parse(request.params).id),
  );
  app.patch("/api/business/companies/:id", async (request) =>
    service.updateCompany(
      idParams.parse(request.params).id,
      updateCompanyInputSchema.parse(request.body),
    ),
  );
  app.delete("/api/business/companies/:id", async (request) =>
    service.deleteCompany(idParams.parse(request.params).id),
  );
  app.post("/api/business/companies/:id/restore", async (request) =>
    service.restoreCompany(idParams.parse(request.params).id),
  );

  app.get("/api/business/contacts", async (request) => {
    const q = searchQuery.parse(request.query);
    return { items: service.listContacts(q.search, q.includeDeleted) };
  });
  app.post("/api/business/contacts", async (request, reply) =>
    reply.code(201).send(service.createContact(request.body)),
  );
  app.get("/api/business/contacts/:id", async (request) =>
    service.getContact(idParams.parse(request.params).id),
  );
  app.patch("/api/business/contacts/:id", async (request) =>
    service.updateContact(
      idParams.parse(request.params).id,
      updateContactInputSchema.parse(request.body),
    ),
  );
  app.delete("/api/business/contacts/:id", async (request) =>
    service.deleteContact(idParams.parse(request.params).id),
  );
  app.post("/api/business/contacts/:id/restore", async (request) =>
    service.restoreContact(idParams.parse(request.params).id),
  );

  app.get("/api/business/opportunities", async (request) => {
    const q = searchQuery.parse(request.query);
    return { items: service.listOpportunities(q.search) };
  });
  app.post("/api/business/opportunities", async (request, reply) =>
    reply.code(201).send(service.createOpportunity(request.body)),
  );
  app.get("/api/business/opportunities/:id", async (request) =>
    service.getOpportunity(idParams.parse(request.params).id),
  );
  app.patch("/api/business/opportunities/:id", async (request) =>
    service.updateOpportunity(
      idParams.parse(request.params).id,
      updateOpportunityInputSchema.parse(request.body),
    ),
  );
  app.post("/api/business/opportunities/:id/stage", async (request) => {
    const b = stageBody.parse(request.body);
    return service.changeOpportunityStage(
      idParams.parse(request.params).id,
      b.stage,
      b.resultSummary,
      b.lossReason,
      b.reason,
    );
  });

  app.get("/api/business/partnerships", async (request) => {
    const q = searchQuery.parse(request.query);
    return { items: service.listPartnerships(q.search) };
  });
  app.post("/api/business/partnerships", async (request, reply) =>
    reply.code(201).send(service.createPartnership(request.body)),
  );
  app.get("/api/business/partnerships/:id", async (request) =>
    service.getPartnership(idParams.parse(request.params).id),
  );
  app.patch("/api/business/partnerships/:id", async (request) =>
    service.updatePartnership(
      idParams.parse(request.params).id,
      updatePartnershipInputSchema.parse(request.body),
    ),
  );
  app.post("/api/business/partnerships/:id/status", async (request) => {
    const b = partnershipStatusBody.parse(request.body);
    return service.changePartnershipStatus(
      idParams.parse(request.params).id,
      b.status,
      b.resultSummary,
      b.reason,
    );
  });

  app.get("/api/business/activities", async (request) => ({
    items: service.listActivities(activityQuery.parse(request.query)),
  }));
  app.post("/api/business/activities", async (request, reply) => {
    const key = request.headers["idempotency-key"];
    return reply
      .code(201)
      .send(service.createActivity(request.body, typeof key === "string" ? key : undefined));
  });
  app.get("/api/business/follow-ups", async (request) => ({
    items: service.listFollowUps(followUpListQuery.parse(request.query).status),
  }));
  app.post("/api/business/follow-ups", async (request, reply) =>
    reply.code(201).send(service.createFollowUp(request.body)),
  );
  app.post("/api/business/follow-ups/:id/status", async (request) => {
    const b = followUpStatusBody.parse(request.body);
    return service.changeFollowUpStatus(
      idParams.parse(request.params).id,
      b.status,
      b.completionNote,
    );
  });
  app.post("/api/business/follow-ups/:id/reschedule", async (request) => {
    const b = rescheduleBody.parse(request.body);
    return service.rescheduleFollowUp(idParams.parse(request.params).id, b.dueAt, b.reason);
  });

  if (aiService) {
    app.post("/api/business/ai-drafts", async (request, reply) => {
      const body = z
        .object({ rawContent: z.string().trim().min(1).max(40_000) })
        .parse(request.body);
      return reply.code(201).send(await aiService.generate(body.rawContent));
    });
    app.get("/api/business/ai-drafts/:id", async (request) =>
      aiService.get(idParams.parse(request.params).id),
    );
    app.post("/api/business/ai-drafts/:id/confirm", async (request) => {
      const key = z.string().min(8).max(200).parse(request.headers["idempotency-key"]);
      return aiService.confirm(idParams.parse(request.params).id, request.body, key);
    });
  }
}
