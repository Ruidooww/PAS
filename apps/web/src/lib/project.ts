import { USER_ROLES } from "@pas/shared";

export const projectOverview = {
  apiPort: 3001,
  mockQaEndpoint: "POST /api/internal/qa",
  roles: [...USER_ROLES],
  webPort: 3000,
} as const;
