import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MakesModelsService } from './makes-models.service';

// No TenantGuard — makes/models are global (shared across tenants)
@Controller('vehicle-lookup')
export class MakesModelsController {
  constructor(private readonly makesModelsService: MakesModelsService) {}

  @Get('makes')
  async listMakes() {
    return this.makesModelsService.listMakes();
  }

  @Get('makes/:makeId/models')
  async listModels(@Param('makeId') makeId: string) {
    return this.makesModelsService.listModels(makeId);
  }

  @Get('models-by-make')
  async listModelsByMakeName(@Query('make') makeName: string) {
    return this.makesModelsService.listModelsByMakeName(makeName);
  }

  @Post('makes')
  async addMake(@Body() body: { name: string; country?: string }) {
    return this.makesModelsService.addMake(body.name, body.country);
  }

  @Post('makes/:makeId/models')
  async addModel(
    @Param('makeId') makeId: string,
    @Body() body: { name: string; bodyType?: string },
  ) {
    return this.makesModelsService.addModel(makeId, body.name, body.bodyType);
  }
}
