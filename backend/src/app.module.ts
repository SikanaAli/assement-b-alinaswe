import { Module } from '@nestjs/common';
import { ApplicationWorkflowModule } from './application-workflow/application-workflow.module';
import { AppController } from './app.controller';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ApplicationWorkflowModule,
    ApplicationsModule,
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
