import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

export interface FeedbackDashboardRangeInput {
  from?: Date;
  to?: Date;
}

export interface FeedbackDashboardResponse {
  range: { from: string; to: string };
  totals: {
    qaCount: number;
    upCount: number;
    downCount: number;
    refusalCount: number;
  };
  rates: {
    upRate: number;
    downRate: number;
    refusalRate: number;
  };
  topDownQueries: TopDownQuery[];
  dailyUsage: Array<{ date: string; count: number }>;
}

export interface TopDownQuery {
  query: string;
  downCount: number;
}

interface TopDownQueryRow {
  query: string;
  downCount: number | bigint;
}

interface CountRow {
  count: number | bigint;
}

interface DailyUsageRow {
  date: string;
  count: number | bigint;
}

@Injectable()
export class FeedbackDashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDashboard(input: FeedbackDashboardRangeInput = {}): Promise<FeedbackDashboardResponse> {
    const range = normalizeDashboardRange(input);
    const createdAt = { gte: range.from, lte: range.to };

    const [qaCount, upCount, downCount, refusalRows, topDownRows, dailyRows] = await Promise.all([
      this.prisma.message.count({
        where: { role: "assistant", createdAt },
      }),
      this.prisma.conversationFeedback.count({
        where: { rating: "up", createdAt },
      }),
      this.prisma.conversationFeedback.count({
        where: { rating: "down", createdAt },
      }),
      this.refusalCountRows(range),
      this.topDownQueries(range),
      this.dailyUsageRows(range),
    ]);

    const refusalCount = Number(refusalRows[0]?.count ?? 0);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      totals: {
        qaCount,
        upCount,
        downCount,
        refusalCount,
      },
      rates: {
        upRate: rate(upCount, qaCount),
        downRate: rate(downCount, qaCount),
        refusalRate: rate(refusalCount, qaCount),
      },
      topDownQueries: normalizeTopDownQueryRows(topDownRows),
      dailyUsage: fillDailyUsage(range, dailyRows),
    };
  }

  private topDownQueries(range: { from: Date; to: Date }): Promise<TopDownQueryRow[]> {
    return this.prisma.$queryRaw<TopDownQueryRow[]>(Prisma.sql`
      WITH down_feedback AS (
        SELECT
          f."id",
          m."conversation_id",
          m."created_at" AS assistant_created_at
        FROM "conversation_feedback" f
        JOIN "messages" m ON m."id" = f."message_id"
        WHERE f."rating" = 'down'::"FeedbackRating"
          AND f."created_at" >= ${range.from}
          AND f."created_at" <= ${range.to}
          AND m."role" = 'assistant'
      ),
      matched_queries AS (
        SELECT user_message."content" AS query
        FROM down_feedback df
        JOIN LATERAL (
          SELECT um."content"
          FROM "messages" um
          WHERE um."conversation_id" = df."conversation_id"
            AND um."role" = 'user'
            AND um."created_at" < df.assistant_created_at
          ORDER BY um."created_at" DESC
          LIMIT 1
        ) user_message ON TRUE
      )
      SELECT
        query,
        COUNT(*)::int AS "downCount"
      FROM matched_queries
      GROUP BY query
      ORDER BY "downCount" DESC, query ASC
      LIMIT 10
    `);
  }

  private refusalCountRows(range: { from: Date; to: Date }): Promise<CountRow[]> {
    return this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "messages" m
      WHERE m."role" = 'assistant'
        AND m."created_at" >= ${range.from}
        AND m."created_at" <= ${range.to}
        AND ${isRefusalMessage()}
    `);
  }

  private dailyUsageRows(range: { from: Date; to: Date }): Promise<DailyUsageRow[]> {
    return this.prisma.$queryRaw<DailyUsageRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc('day', m."created_at"), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "messages" m
      WHERE m."role" = 'assistant'
        AND m."created_at" >= ${range.from}
        AND m."created_at" <= ${range.to}
      GROUP BY date
      ORDER BY date ASC
    `);
  }
}

export function isRefusalMessage(tableAlias = "m"): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableAlias)) {
    throw new Error("Invalid table alias for refusal message SQL");
  }
  return Prisma.raw(`(${tableAlias}."refs" IS NULL OR jsonb_array_length(${tableAlias}."refs") = 0)`);
}

export function normalizeTopDownQueryRows(rows: TopDownQueryRow[]): TopDownQuery[] {
  return rows
    .map((row) => ({ query: row.query, downCount: Number(row.downCount) }))
    .sort((a, b) => b.downCount - a.downCount || a.query.localeCompare(b.query))
    .slice(0, 10);
}

export function normalizeDashboardRange(
  input: FeedbackDashboardRangeInput,
  now = new Date(),
): { from: Date; to: Date } {
  const to = input.to ?? endOfUtcDay(now);
  const from = input.from ?? addUtcDays(startOfUtcDay(to), -(DEFAULT_WINDOW_DAYS - 1));
  return { from, to };
}

function fillDailyUsage(
  range: { from: Date; to: Date },
  rows: DailyUsageRow[],
): Array<{ date: string; count: number }> {
  const counts = new Map(rows.map((row) => [row.date, Number(row.count)]));
  const start = startOfUtcDay(range.from);
  const end = startOfUtcDay(range.to);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = formatDate(addUtcDays(start, index));
    return { date, count: counts.get(date) ?? 0 };
  });
}

function rate(count: number, qaCount: number): number {
  if (qaCount === 0) return 0;
  return Number((count / qaCount).toFixed(4));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(addUtcDays(date, 1)).getTime() - 1);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
