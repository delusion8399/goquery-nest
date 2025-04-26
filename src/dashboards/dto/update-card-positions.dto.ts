import { IsArray, IsMongoId, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
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

class CardPositionUpdateDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CardPositionDto)
  @IsNotEmpty()
  position: CardPositionDto;
}

export class UpdateCardPositionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardPositionUpdateDto)
  @IsNotEmpty()
  cards: CardPositionUpdateDto[];
}
