import { IsEnum, IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CardType, ChartType } from 'src/database/models/dashboard.entity';
import { Type } from 'class-transformer';

class CardPositionDto {
  @IsNotEmpty()
  x: number;

  @IsNotEmpty()
  y: number;

  @IsNotEmpty()
  w: number;

  @IsNotEmpty()
  h: number;
}

export class AddCardDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(CardType)
  @IsNotEmpty()
  type: CardType;

  @IsMongoId()
  @IsOptional()
  queryId?: string;

  @IsEnum(ChartType)
  @IsOptional()
  chartType?: ChartType;

  @IsObject()
  @ValidateNested()
  @Type(() => CardPositionDto)
  @IsNotEmpty()
  position: CardPositionDto;
}
