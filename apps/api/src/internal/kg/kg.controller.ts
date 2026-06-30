import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../../auth/auth.guard";
import { InternalOnlyGuard } from "../internal-only.guard";
import {
  KG_ENTITY_TYPES,
  KG_RELATION_TYPES,
  KgService,
  type KgEntityTypeValue,
  type KgRelationTypeValue,
} from "./kg.service";

@Controller("api/internal/kg")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class KgController {
  constructor(@Inject(KgService) private readonly kg: KgService) {}

  @Get("entities")
  findEntities(@Query("type") type: string, @Query("q") q?: string) {
    return this.kg.findEntities({ type: parseEntityType(type), q });
  }

  @Get("entities/:id/related")
  related(
    @Param("id") id: string,
    @Query("relationType") relationType?: string,
    @Query("depth") depth?: string,
  ) {
    return this.kg.related(id, {
      relationType: parseOptionalRelationType(relationType),
      depth: parseDepth(depth),
    });
  }

  @Get("path")
  path(@Query("from") from?: string, @Query("to") to?: string) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException("from and to must be non-empty strings");
    }
    return this.kg.findPath(from.trim(), to.trim());
  }
}

function parseEntityType(value: string): KgEntityTypeValue {
  if (KG_ENTITY_TYPES.includes(value as KgEntityTypeValue)) {
    return value as KgEntityTypeValue;
  }
  throw new BadRequestException("type must be product, proposal, customer, or industry");
}

function parseOptionalRelationType(value: string | undefined): KgRelationTypeValue | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (KG_RELATION_TYPES.includes(value as KgRelationTypeValue)) {
    return value as KgRelationTypeValue;
  }
  throw new BadRequestException("relationType is not supported");
}

function parseDepth(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new BadRequestException("depth must be an integer between 1 and 3");
  }
  return parsed;
}
