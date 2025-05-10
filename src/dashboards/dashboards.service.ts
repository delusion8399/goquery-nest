import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { AddCardDto } from "./dto/add-card.dto";
import { CreateDashboardDto } from "./dto/create-dashboard.dto";
import { UpdateCardDto } from "./dto/update-card.dto";
import { UpdateCardPositionsDto } from "./dto/update-card-positions.dto";
import { UpdateDashboardDto } from "./dto/update-dashboard.dto";

@Injectable()
export class DashboardsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createDashboard(
    userId: string,
    createDashboardDto: CreateDashboardDto
  ) {
    if (createDashboardDto.isDefault) {
      await this.databaseService.dashboardModel.updateMany(
        { userId: this.databaseService.ObjectId(userId), isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newDashboard = await this.databaseService.dashboardModel.create({
      userId: this.databaseService.ObjectId(userId),
      ...createDashboardDto,
      cards: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newDashboard;
  }

  async getDashboards(userId: string) {
    const dashboards = await this.databaseService.dashboardModel.find({
      userId: this.databaseService.ObjectId(userId),
    });
    return { results: dashboards };
  }

  async getDashboard(userId: string, dashboardId: string) {
    const dashboard = await this.databaseService.dashboardModel.findOne({
      _id: this.databaseService.ObjectId(dashboardId),
      userId: this.databaseService.ObjectId(userId),
    });

    if (!dashboard) {
      throw new NotFoundException("Dashboard not found");
    }

    return dashboard;
  }

  async updateDashboard(
    userId: string,
    dashboardId: string,
    updateDashboardDto: UpdateDashboardDto
  ) {
    // If this is set as default, unset any existing default
    if (updateDashboardDto.isDefault) {
      await this.databaseService.dashboardModel.updateMany(
        {
          userId: this.databaseService.ObjectId(userId),
          isDefault: true,
          _id: { $ne: this.databaseService.ObjectId(dashboardId) },
        },
        { $set: { isDefault: false } }
      );
    }

    const dashboard =
      await this.databaseService.dashboardModel.findOneAndUpdate(
        {
          _id: this.databaseService.ObjectId(dashboardId),
          userId: this.databaseService.ObjectId(userId),
        },
        {
          $set: {
            ...updateDashboardDto,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

    if (!dashboard) {
      throw new NotFoundException("Dashboard not found");
    }

    return dashboard;
  }

  async deleteDashboard(userId: string, dashboardId: string) {
    const dashboard =
      await this.databaseService.dashboardModel.findOneAndDelete({
        _id: this.databaseService.ObjectId(dashboardId),
        userId: this.databaseService.ObjectId(userId),
      });

    if (!dashboard) {
      throw new NotFoundException("Dashboard not found");
    }

    return { success: true };
  }

  async addCard(userId: string, dashboardId: string, addCardDto: AddCardDto) {
    // Check if dashboard exists
    const dashboard = await this.getDashboard(userId, dashboardId);

    // If queryId is provided, check if query exists and user has access to it
    if (addCardDto.queryId) {
      const query = await this.databaseService.queryModel.findOne({
        _id: this.databaseService.ObjectId(addCardDto.queryId),
        userId: this.databaseService.ObjectId(userId),
      });

      if (!query) {
        throw new NotFoundException("Query not found");
      }
    }

    // Create a new card ID
    const cardId = this.databaseService.ObjectId();

    // Add card to dashboard
    const updatedDashboard =
      await this.databaseService.dashboardModel.findOneAndUpdate(
        {
          _id: this.databaseService.ObjectId(dashboardId),
          userId: this.databaseService.ObjectId(userId),
        },
        {
          $push: {
            cards: {
              _id: cardId,
              ...addCardDto,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

    return {
      dashboard: updatedDashboard,
      card: updatedDashboard.cards.find(
        (card) => card._id.toString() === cardId.toString()
      ),
    };
  }

  async updateCard(
    userId: string,
    dashboardId: string,
    cardId: string,
    updateCardDto: UpdateCardDto
  ) {
    // Check if dashboard exists
    const dashboard = await this.getDashboard(userId, dashboardId);

    // Check if card exists
    const cardIndex = dashboard.cards.findIndex(
      (card) => card._id.toString() === cardId
    );
    if (cardIndex === -1) {
      throw new NotFoundException("Card not found");
    }

    // If queryId is provided, check if query exists and user has access to it
    if (updateCardDto.queryId) {
      const query = await this.databaseService.queryModel.findOne({
        _id: this.databaseService.ObjectId(updateCardDto.queryId),
        userId: this.databaseService.ObjectId(userId),
      });

      if (!query) {
        throw new NotFoundException("Query not found");
      }
    }

    // Update card
    const updateData = {};
    for (const [key, value] of Object.entries(updateCardDto)) {
      updateData[`cards.${cardIndex}.${key}`] = value;
    }
    updateData[`cards.${cardIndex}.updatedAt`] = new Date();
    updateData["updatedAt"] = new Date();

    const updatedDashboard =
      await this.databaseService.dashboardModel.findOneAndUpdate(
        {
          _id: this.databaseService.ObjectId(dashboardId),
          userId: this.databaseService.ObjectId(userId),
        },
        { $set: updateData },
        { new: true }
      );

    return {
      dashboard: updatedDashboard,
      card: updatedDashboard.cards[cardIndex],
    };
  }

  async deleteCard(userId: string, dashboardId: string, cardId: string) {
    // Check if dashboard exists
    const dashboard = await this.getDashboard(userId, dashboardId);

    // Check if card exists
    const cardExists = dashboard.cards.some(
      (card) => card._id.toString() === cardId
    );
    if (!cardExists) {
      throw new NotFoundException("Card not found");
    }

    // Delete card
    const updatedDashboard =
      await this.databaseService.dashboardModel.findOneAndUpdate(
        {
          _id: this.databaseService.ObjectId(dashboardId),
          userId: this.databaseService.ObjectId(userId),
        },
        {
          $pull: {
            cards: { _id: this.databaseService.ObjectId(cardId) },
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

    return {
      dashboard: updatedDashboard,
      success: true,
    };
  }

  async updateCardPositions(
    userId: string,
    dashboardId: string,
    updateCardPositionsDto: UpdateCardPositionsDto
  ) {
    // Check if dashboard exists
    const dashboard = await this.getDashboard(userId, dashboardId);

    // Update each card position
    for (const cardUpdate of updateCardPositionsDto.cards) {
      const cardIndex = dashboard.cards.findIndex(
        (card) => card._id.toString() === cardUpdate._id
      );
      if (cardIndex === -1) {
        throw new NotFoundException(`Card with ID ${cardUpdate._id} not found`);
      }

      await this.databaseService.dashboardModel.updateOne(
        {
          _id: this.databaseService.ObjectId(dashboardId),
          userId: this.databaseService.ObjectId(userId),
          "cards._id": this.databaseService.ObjectId(cardUpdate._id),
        },
        {
          $set: {
            "cards.$.position": cardUpdate.position,
            "cards.$.updatedAt": new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    return this.getDashboard(userId, dashboardId);
  }
}
