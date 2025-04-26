import { IsEnum, IsMongoId, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CardType, ChartType } from 'src/database/models/dashboard.entity';
import { Type } from 'class-transformer';

class CardPositionDto {
  @IsOptional()
  x?: number;

  @IsOptional()
  y?: number;

  @IsOptional()
  w?: number;

  @IsOptional()
  h?: number;
}

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(CardType)
  @IsOptional()
  type?: CardType;

  @IsMongoId()
  @IsOptional()
  queryId?: string;

  @IsEnum(ChartType)
  @IsOptional()
  chartType?: ChartType;

  @IsObject()
  @ValidateNested()
  @Type(() => CardPositionDto)
  @IsOptional()
  position?: CardPositionDto;
}
