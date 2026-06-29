import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ReviewerQueueQueryDto } from './dto/reviewer-queue-query.dto';
import { ReviewerTransitionDto } from './dto/reviewer-transition.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('Applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'Create a draft application for the current applicant.' })
  create(
    @CurrentUser() currentUser: AuthUser,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(currentUser, createApplicationDto);
  }

  @Get('my')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'List applications owned by the current applicant.' })
  listMyApplications(@CurrentUser() currentUser: AuthUser) {
    return this.applicationsService.listMyApplications(currentUser);
  }

  @Get('reviewer/queue')
  @Roles(Role.REVIEWER)
  @ApiOperation({ summary: 'List reviewer queue items with optional filters and pagination.' })
  reviewerQueue(
    @CurrentUser() currentUser: AuthUser,
    @Query() reviewerQueueQueryDto: ReviewerQueueQueryDto,
  ) {
    return this.applicationsService.reviewerQueue(
      currentUser,
      reviewerQueueQueryDto,
    );
  }

  @Get(':id')
  @Roles(Role.APPLICANT, Role.REVIEWER)
  @ApiOperation({ summary: 'Get a single application with its audit log.' })
  getById(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.getById(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'Update an applicant-owned application.' })
  update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateApplicationDto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(currentUser, id, updateApplicationDto);
  }

  @Post(':id/submit')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'Submit a draft application.' })
  submit(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.submit(currentUser, id);
  }

  @Post(':id/transition')
  @Roles(Role.REVIEWER)
  @ApiOperation({ summary: 'Apply a reviewer workflow transition.' })
  transition(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() reviewerTransitionDto: ReviewerTransitionDto,
  ) {
    return this.applicationsService.reviewerTransition(
      currentUser,
      id,
      reviewerTransitionDto,
    );
  }
}
