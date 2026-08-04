import { IsUUID, IsIn, IsOptional, ValidateIf } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  member_id: string;

  /**
   * Required for a membership purchase. Omitted when collecting an existing
   * invoice — then the amount comes from that invoice's outstanding balance
   * instead of a plan price.
   */
  @ValidateIf((o: CreateOrderDto) => !o.invoice_id)
  @IsUUID()
  plan_id?: string;

  /** Collect against an existing invoice instead of selling a plan. */
  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsUUID()
  branch_id: string;

  @IsIn(['razorpay'])
  gateway: 'razorpay';
}
