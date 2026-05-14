import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CostingService } from '../parts/costing.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPurchaseOrderSchema,
  createPoLineSchema,
  receiveGoodsSchema,
  paginationSchema,
  applyLandedCostsSchema,
  rejectPurchaseOrderSchema,
} from '@mecanix/validators';
import type {
  CreatePurchaseOrderInput,
  CreatePoLineInput,
  ReceiveGoodsInput,
  PaginationInput,
  ApplyLandedCostsInput,
  RejectPurchaseOrderInput,
} from '@mecanix/validators';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { Logger } from '@nestjs/common';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { z } from 'zod';

const changePoStatusSchema = z.object({
  status: z.string().min(1),
});

@Controller('purchase-orders')
@UseGuards(TenantGuard)
export class PurchaseOrdersController {
  private readonly logger = new Logger('PurchaseOrdersController');

  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly costingService: CostingService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.purchaseOrdersService.list(tenantId, query, vendorId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPurchaseOrderSchema)) body: CreatePurchaseOrderInput,
  ) {
    return this.purchaseOrdersService.create(tenantId, user.id, body);
  }

  @Post(':id/lines')
  async addLine(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPoLineSchema)) body: CreatePoLineInput,
  ) {
    return this.purchaseOrdersService.addLine(tenantId, id, user.id, body);
  }

  @Delete(':id/lines/:lineId')
  async removeLine(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.purchaseOrdersService.removeLine(tenantId, lineId, id);
  }

  @Post(':id/receive')
  async receiveGoods(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(receiveGoodsSchema)) body: ReceiveGoodsInput,
  ) {
    return this.purchaseOrdersService.receiveGoods(tenantId, id, user.id, body);
  }

  @Patch(':id/status')
  async updateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changePoStatusSchema)) body: { status: string },
  ) {
    return this.purchaseOrdersService.updateStatus(tenantId, id, user.id, body.status);
  }

  @Post(':id/landed-costs')
  async applyLandedCosts(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(applyLandedCostsSchema)) body: ApplyLandedCostsInput,
  ) {
    return this.costingService.applyLandedCosts(tenantId, id, body.additionalCosts);
  }

  // ── Approval workflow ────────────────────────────────────────

  @Post(':id/submit')
  async submit(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const result = await this.purchaseOrdersService.submitForApproval(tenantId, id, user.id);

    if (result.needsApproverNotification) {
      // Fan-out WhatsApp notifications to approvers. Non-blocking: if
      // any send fails (template not registered, missing phone, etc.)
      // we log and carry on so the submit response isn't held up.
      const approvers = await this.purchaseOrdersService.getApproverUsers(tenantId);
      const po = result.po as Record<string, unknown>;
      const poNumber = String(po.po_number ?? '');
      const total = Number(po.total_amount ?? 0).toFixed(2);

      Promise.allSettled(
        approvers
          .filter((a) => a.whatsapp_number || a.phone)
          .map((a) =>
            this.whatsapp.sendTemplate(
              (a.whatsapp_number ?? a.phone)!,
              'po_pending_approval',
              'pt_PT',
              [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: poNumber },
                    { type: 'text', text: total },
                    { type: 'text', text: a.full_name ?? '—' },
                  ],
                },
              ],
              { tenantId, contextType: 'generic', contextId: id },
            ),
          ),
      ).then((settled) => {
        const sent = settled.filter((s) => s.status === 'fulfilled').length;
        this.logger.log(`PO ${poNumber} submit: notified ${sent}/${approvers.length} approver(s)`);
      });
    }

    return result;
  }

  @Post(':id/approve')
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    // Role check against tenant's po_approver_roles config
    const cfg = await this.purchaseOrdersService['getApprovalConfig'](tenantId);
    if (!cfg.roles.includes(user.role)) {
      throw new BadRequestException(
        `Your role '${user.role}' is not authorised to approve POs (allowed: ${cfg.roles.join(', ')})`,
      );
    }
    return this.purchaseOrdersService.approve(tenantId, id, user.id);
  }

  @Post(':id/reject')
  async reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectPurchaseOrderSchema)) body: RejectPurchaseOrderInput,
  ) {
    const cfg = await this.purchaseOrdersService['getApprovalConfig'](tenantId);
    if (!cfg.roles.includes(user.role)) {
      throw new BadRequestException(
        `Your role '${user.role}' is not authorised to reject POs (allowed: ${cfg.roles.join(', ')})`,
      );
    }
    return this.purchaseOrdersService.reject(tenantId, id, user.id, body.reason);
  }

  @Post(':id/reopen')
  async reopen(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.reopen(tenantId, id, user.id);
  }
}
