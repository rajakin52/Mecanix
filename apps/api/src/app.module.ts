import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TimeModule } from './modules/time/time.module';
import { PartsModule } from './modules/parts/parts.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    TenantsModule,
    CustomersModule,
    VehiclesModule,
    TechniciansModule,
    JobsModule,
    TimeModule,
    PartsModule,
    PurchasesModule,
    ExpensesModule,
    InvoicesModule,
    InsuranceModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
