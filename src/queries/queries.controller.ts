import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QueriesService } from './queries.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';

@Controller('api/queries')
@UseGuards(AuthGuard('jwt'))
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  @Post()
  async createQuery(@Req() req, @Body() createQueryDto: CreateQueryDto) {
    return this.queriesService.createQuery(req.user.userId, createQueryDto);
  }

  @Get()
  async getQueries(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.queriesService.getQueries(req.user.userId, page, limit);
  }

  @Get(':id')
  async getQuery(@Req() req, @Param('id') id: string) {
    return this.queriesService.getQuery(req.user.userId, id);
  }

  @Put(':id')
  async updateQuery(
    @Req() req,
    @Param('id') id: string,
    @Body() updateQueryDto: UpdateQueryDto,
  ) {
    return this.queriesService.updateQuery(req.user.userId, id, updateQueryDto);
  }

  @Delete(':id')
  async deleteQuery(@Req() req, @Param('id') id: string) {
    return this.queriesService.deleteQuery(req.user.userId, id);
  }

  @Post(':id/rerun')
  async rerunQuery(@Req() req, @Param('id') id: string) {
    return this.queriesService.rerunQuery(req.user.userId, id);
  }
}
