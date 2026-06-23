import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  type MessageEvent,
  Post,
  Req,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { Subject, type Observable } from "rxjs";

import { AuthGuard } from "../../auth/auth.guard";
import type { AuthenticatedRequest } from "../../auth/types";
import { QaService } from "../../qa/qa.service";
import type { QaRequest, QaStreamEvent } from "../../qa/qa.types";
import { InternalOnlyGuard } from "../internal-only.guard";

@Controller("api/internal/qa")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class InternalQaController {
  constructor(@Inject(QaService) private readonly qa: QaService) {}

  @Post()
  @HttpCode(200)
  @Sse()
  ask(
    @Body() body: { query?: unknown; sessionId?: unknown; history?: unknown },
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    if (typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new BadRequestException("query must be a non-empty string");
    }
    const request: QaRequest = {
      query: body.query.trim(),
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      history: parseHistory(body.history),
    };
    return toSseObservable(this.qa.answer(request, req.user!));
  }
}

function parseHistory(history: unknown): QaRequest["history"] {
  if (!Array.isArray(history)) return undefined;
  return history
    .filter(
      (message): message is { role: "assistant" | "system" | "user"; content: string } =>
        message &&
        typeof message === "object" &&
        "content" in message &&
        typeof message.content === "string" &&
        "role" in message &&
        (message.role === "assistant" || message.role === "system" || message.role === "user"),
    )
    .map((message) => ({ role: message.role, content: message.content }));
}

function toSseObservable(events: AsyncIterable<QaStreamEvent>): Observable<MessageEvent> {
  const subject = new Subject<MessageEvent>();
  void (async () => {
    try {
      for await (const event of events) {
        subject.next({ data: event });
      }
      subject.complete();
    } catch (error) {
      subject.error(error);
    }
  })();
  return subject.asObservable();
}


