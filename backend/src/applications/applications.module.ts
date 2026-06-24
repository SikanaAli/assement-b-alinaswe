import { Module } from '@nestjs/common';
import { ApplicationWorkflowModule } from '../application-workflow/application-workflow.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [ApplicationWorkflowModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

