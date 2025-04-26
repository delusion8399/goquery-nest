import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardsService } from './dashboards.service';
import { AddCardDto } from './dto/add-card.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { UpdateCardPositionsDto } from './dto/update-card-positions.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Controller('api/dashboards')
@UseGuards(AuthGuard('jwt'))
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  async createDashboard(@Req() req, @Body() createDashboardDto: CreateDashboardDto) {
    return this.dashboardsService.createDashboard(req.user.userId, createDashboardDto);
  }

  @Get()
  async getDashboards(@Req() req) {
    return this.dashboardsService.getDashboards(req.user.userId);
  }

  @Get(':id')
  async getDashboard(@Req() req, @Param('id') id: string) {
    return this.dashboardsService.getDashboard(req.user.userId, id);
  }

  @Put(':id')
  async updateDashboard(
    @Req() req,
    @Param('id') id: string,
    @Body() updateDashboardDto: UpdateDashboardDto,
  ) {
    return this.dashboardsService.updateDashboard(req.user.userId, id, updateDashboardDto);
  }

  @Delete(':id')
  async deleteDashboard(@Req() req, @Param('id') id: string) {
    return this.dashboardsService.deleteDashboard(req.user.userId, id);
  }

  @Post(':id/cards')
  async addCard(
    @Req() req,
    @Param('id') id: string,
    @Body() addCardDto: AddCardDto,
  ) {
    return this.dashboardsService.addCard(req.user.userId, id, addCardDto);
  }

  @Put(':id/cards/:cardId')
  async updateCard(
    @Req() req,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.dashboardsService.updateCard(req.user.userId, id, cardId, updateCardDto);
  }

  @Delete(':id/cards/:cardId')
  async deleteCard(
    @Req() req,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
  ) {
    return this.dashboardsService.deleteCard(req.user.userId, id, cardId);
  }

  @Put(':id/cards')
  async updateCardPositions(
    @Req() req,
    @Param('id') id: string,
    @Body() updateCardPositionsDto: UpdateCardPositionsDto,
  ) {
    return this.dashboardsService.updateCardPositions(req.user.userId, id, updateCardPositionsDto);
  }
}
