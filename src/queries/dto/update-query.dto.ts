import { IsOptional, IsString } from 'class-validator';

export class UpdateQueryDto {
  @IsString()
  @IsOptional()
  name?: string;
}
