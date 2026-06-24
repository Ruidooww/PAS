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
import type {
  QaFeedbackRequest,
  QaFeedbackResult,
  QaRequest,
  QaStreamEvent,
} from "../../qa/qa.types";
import { InternalOnlyGuard } from "../internal-only.guard";

@Controller("api/internal/qa")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class InternalQaController {
  constructor(@Inject(QaService) private readonly qa: QaService) {}

  @Post("feedback")
  @HttpCode(200)
  submitFeedback(
    @Body() body: { messageId?: unknown; rating?: unknown; comment?: unknown },
    @Req() req: AuthenticatedRequest,
  ): Promise<QaFeedbackResult> {
    if (typeof body.messageId !== "string" || body.messageId.trim().length === 0) {
      throw new BadRequestException("messageId must be a non-empty string");
    }
    if (body.rating !== "up" && body.rating !== "down") {
      throw new BadRequestException("rating must be up or down");
    }
    if (body.comment !== undefined && typeof body.comment !== "string") {
      throw new BadRequestException("comment must be a string");
    }
    const request: QaFeedbackRequest = {
      messageId: body.messageId.trim(),
      rating: body.rating,
      comment:
        typeof body.comment === "string" && body.comment.trim().length > 0
          ? body.comment.trim()
          : undefined,
    };
    return this.qa.submitFeedback(request, req.user!);
  }

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


