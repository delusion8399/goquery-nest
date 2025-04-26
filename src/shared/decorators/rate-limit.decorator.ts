import { SetMetadata } from "@nestjs/common";

export const RateLimit = () => SetMetadata("rate_limit", true);
