import { Module } from '@nestjs/common';
import { ApplicationWorkflowService } from './application-workflow.service';

@Module({
  providers: [ApplicationWorkflowService],
  exports: [ApplicationWorkflowService],
})
export class ApplicationWorkflowModule {}

