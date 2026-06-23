import { ForbiddenException } from "@nestjs/common";

export class InternalOnlyForbiddenException extends ForbiddenException {
  constructor() {
    super("External users cannot access internal routes");
  }
}
