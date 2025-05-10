import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatsService } from './stats.service';

@Controller('api/stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  async getDashboardStats(@Req() req) {
    return this.statsService.getDashboardStats(req.user.userId);
  }

  @Get('queries/count')
  async getQueriesCount(@Req() req) {
    const count = await this.statsService.getTotalQueries(req.user.userId);
    return { count };
  }

  @Get('databases/count')
  async getDatabasesCount(@Req() req) {
    const count = await this.statsService.getDatabasesCount(req.user.userId);
    return { count };
  }

  @Get('saved-queries/count')
  async getSavedQueriesCount(@Req() req) {
    const count = await this.statsService.getSavedQueriesCount(req.user.userId);
    return { count };
  }

  @Get('api-calls/count')
  async getApiCallsCount(@Req() req) {
    const count = await this.statsService.getApiCallsCount(req.user.userId);
    return { count };
  }
}
