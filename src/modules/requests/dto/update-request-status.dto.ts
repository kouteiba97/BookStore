import { IsIn } from 'class-validator';
import { REQUEST_STATUSES } from '../../../common/validation/query';

export class UpdateRequestStatusDto {
  @IsIn(REQUEST_STATUSES)
  status: (typeof REQUEST_STATUSES)[number];
}
