import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TecDocService } from './tecdoc.service';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('tecdoc')
@UseGuards(TenantGuard)
export class TecDocController {
  constructor(private readonly tecdocService: TecDocService) {}

  @Get('search')
  async searchByVehicle(
    @Query('make') make: string,
    @Query('model') model: string,
    @Query('year') year?: string,
  ) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.tecdocService.searchByVehicle(make, model, yearNum);
  }

  @Get('part/:partNumber')
  async searchByPartNumber(@Param('partNumber') partNumber: string) {
    return this.tecdocService.searchByPartNumber(partNumber);
  }

  @Get('vehicles/:make')
  async getVehicleTypes(@Param('make') make: string) {
    return this.tecdocService.getVehicleTypes(make);
  }
}
