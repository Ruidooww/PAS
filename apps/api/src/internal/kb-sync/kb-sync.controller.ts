import { Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthGuard } from "../../auth/auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { InternalOnlyGuard } from "../internal-only.guard";
import { KbSyncService, type KbSyncRunSummary } from "./kb-sync.service";

export interface KbSyncRunResponse {
  syncedDocs: number;
  ragflowKbId: string;
  ranAt: string;
}

@Controller("api/internal/kb-sync")
@UseGuards(AuthGuard, InternalOnlyGuard, RolesGuard)
@Roles("admin")
export class KbSyncController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(KbSyncService) private readonly kbSyncService: KbSyncService,
  ) {}

  @Post("run")
  async run(): Promise<KbSyncRunResponse> {
    if (this.config.get<string>("RAGFLOW_CLIENT_MODE") === "mock") {
      return {
        syncedDocs: 0,
        ragflowKbId: "mock",
        ranAt: new Date().toISOString(),
      };
    }

    return toRunResponse(await this.kbSyncService.runOnce({ throwOnFailure: true }));
  }
}

function toRunResponse(summary: KbSyncRunSummary): KbSyncRunResponse {
  const syncedDocs = summary.runs.reduce((sum, run) => sum + run.added + run.updated, 0);
  return {
    syncedDocs,
    ragflowKbId: summary.runs.map((run) => run.kbId).join(","),
    ranAt: new Date().toISOString(),
  };
}
