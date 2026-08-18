import { randomUUID } from "node:crypto";

import type {
  CreateRetrospectiveInput,
  Retrospective,
  UpdateRetrospectiveInput,
} from "../../../shared/retrospective-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { WorkbenchDatabase } from "../../db/connection";

interface RetrospectiveRow {
  id: string;
  title: string;
  review: string;
  did_well: string;
  did_wrong: string;
  lesson: string;
  next_improvement: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRetrospective(row: RetrospectiveRow): Retrospective {
  return {
    id: row.id,
    title: row.title,
    review: row.review,
    didWell: row.did_well,
    didWrong: row.did_wrong,
    lesson: row.lesson,
    nextImprovement: row.next_improvement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class RetrospectiveRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  list(): Retrospective[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM retrospectives WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC",
        )
        .all() as unknown as RetrospectiveRow[]
    ).map(mapRetrospective);
  }

  get(id: string, includeDeleted = false): Retrospective {
    const row = this.database
      .prepare(
        `SELECT * FROM retrospectives WHERE id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`,
      )
      .get(id) as RetrospectiveRow | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "经验复盘不存在", 404);
    return mapRetrospective(row);
  }

  create(input: CreateRetrospectiveInput): Retrospective {
    const id = randomUUID();
    const timestamp = this.now();
    this.database
      .prepare(
        `INSERT INTO retrospectives (
          id, title, review, did_well, did_wrong, lesson, next_improvement,
          created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        input.title,
        input.review ?? "",
        input.didWell ?? "",
        input.didWrong ?? "",
        input.lesson ?? "",
        input.nextImprovement ?? "",
        timestamp,
        timestamp,
      );
    return this.get(id);
  }

  update(id: string, input: UpdateRetrospectiveInput): Retrospective {
    const current = this.get(id);
    const result = this.database
      .prepare(
        `UPDATE retrospectives SET
          title = ?, review = ?, did_well = ?, did_wrong = ?, lesson = ?,
          next_improvement = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(
        input.title ?? current.title,
        input.review ?? current.review,
        input.didWell ?? current.didWell,
        input.didWrong ?? current.didWrong,
        input.lesson ?? current.lesson,
        input.nextImprovement ?? current.nextImprovement,
        this.now(),
        id,
      );
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "经验复盘不存在", 404);
    return this.get(id);
  }

  softDelete(id: string): Retrospective {
    const timestamp = this.now();
    const result = this.database
      .prepare(
        "UPDATE retrospectives SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
      .run(timestamp, timestamp, id);
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "经验复盘不存在", 404);
    return this.get(id, true);
  }
}
