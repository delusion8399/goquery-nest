import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional } from "class-validator";

export class FindAllDto {
  @IsOptional()
  _q?: string;

  @IsNotEmpty()
  page: string;

  @IsNotEmpty()
  sort: "asc" | "desc";

  @IsNotEmpty()
  limit: string;

  @IsOptional()
  companyRef: string;

  @IsOptional()
  userRef: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value
  )
  printer: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value
  )
  populate: boolean;

  @IsOptional()
  parent?: string;

  @IsOptional()
  activeTab?: string;

  @IsOptional()
  locationRef?: string;

  @IsOptional()
  _project: string;

  @IsOptional()
  _populate: string;

  @IsOptional()
  onlineOrdering: string;

  @IsOptional()
  qrOrdering: string;
}
