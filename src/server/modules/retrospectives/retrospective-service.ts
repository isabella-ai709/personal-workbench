import {
  createRetrospectiveInputSchema,
  updateRetrospectiveInputSchema,
  type CreateRetrospectiveInput,
  type Retrospective,
  type UpdateRetrospectiveInput,
} from "../../../shared/retrospective-contracts";
import type { RetrospectiveRepository } from "./retrospective-repository";

export class RetrospectiveService {
  constructor(private readonly repository: RetrospectiveRepository) {}

  list(): Retrospective[] {
    return this.repository.list();
  }

  get(id: string): Retrospective {
    return this.repository.get(id);
  }

  create(input: CreateRetrospectiveInput): Retrospective {
    return this.repository.create(createRetrospectiveInputSchema.parse(input));
  }

  update(id: string, input: UpdateRetrospectiveInput): Retrospective {
    return this.repository.update(id, updateRetrospectiveInputSchema.parse(input));
  }

  delete(id: string): Retrospective {
    return this.repository.softDelete(id);
  }
}
