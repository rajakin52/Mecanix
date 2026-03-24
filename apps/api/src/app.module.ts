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
import { InspectionsModule } from './modules/inspections/inspections.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TecDocModule } from './modules/tecdoc/tecdoc.module';
import { MpesaModule } from './modules/mpesa/mpesa.module';
import { PettyCashModule } from './modules/petty-cash/petty-cash.module';
import { DocumentRemindersModule } from './modules/document-reminders/document-reminders.module';
import { CrmModule } from './modules/crm/crm.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { GatePassModule } from './modules/gate-pass/gate-pass.module';
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { AmcModule } from './modules/amc/amc.module';
import { MarketingModule } from './modules/marketing/marketing.module';
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
    InspectionsModule,
    NotificationsModule,
    ReportsModule,
    AppointmentsModule,
    RemindersModule,
    TecDocModule,
    MpesaModule,
    PettyCashModule,
    DocumentRemindersModule,
    CrmModule,
    LoyaltyModule,
    GatePassModule,
    HealthModule,
    AiModule,
    AmcModule,
    MarketingModule,
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
