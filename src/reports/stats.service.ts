import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { QueryStatus } from 'src/database/models/query.entity';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getTotalQueries(userId: string): Promise<number> {
    try {
      const count = await this.databaseService.queryModel.countDocuments({
        userId: this.databaseService.ObjectId(userId),
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting total queries: ${error.message}`);
      return 0;
    }
  }

  async getDatabasesCount(userId: string): Promise<number> {
    try {
      const count = await this.databaseService.databaseModel.countDocuments({
        userId: this.databaseService.ObjectId(userId),
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting databases count: ${error.message}`);
      return 0;
    }
  }

  async getSavedQueriesCount(userId: string): Promise<number> {
    try {
      const count = await this.databaseService.queryModel.countDocuments({
        userId: this.databaseService.ObjectId(userId),
        name: { $exists: true, $ne: '' },
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting saved queries count: ${error.message}`);
      return 0;
    }
  }

  async getApiCallsCount(userId: string): Promise<number> {
    try {
      // For API calls, we'll count all completed queries as API calls
      // This is a simplification - in a real app, you might track API calls separately
      const count = await this.databaseService.queryModel.countDocuments({
        userId: this.databaseService.ObjectId(userId),
        status: QueryStatus.COMPLETED,
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting API calls count: ${error.message}`);
      return 0;
    }
  }

  async getRecentQueries(userId: string, limit: number = 5) {
    try {
      const queries = await this.databaseService.queryModel
        .find({
          userId: this.databaseService.ObjectId(userId),
        })
        .sort({ createdAt: -1 })
        .limit(limit);

      return queries;
    } catch (error) {
      this.logger.error(`Error getting recent queries: ${error.message}`);
      return [];
    }
  }

  async getDashboardStats(userId: string) {
    try {
      const [totalQueries, databasesCount, savedQueriesCount, apiCallsCount, recentQueries] =
        await Promise.all([
          this.getTotalQueries(userId),
          this.getDatabasesCount(userId),
          this.getSavedQueriesCount(userId),
          this.getApiCallsCount(userId),
          this.getRecentQueries(userId),
        ]);

      return {
        totalQueries,
        databasesCount,
        savedQueriesCount,
        apiCallsCount,
        recentQueries,
      };
    } catch (error) {
      this.logger.error(`Error getting dashboard stats: ${error.message}`);
      return {
        totalQueries: 0,
        databasesCount: 0,
        savedQueriesCount: 0,
        apiCallsCount: 0,
        recentQueries: [],
      };
    }
  }
}
