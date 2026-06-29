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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Category, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateApplicationDto } from './dto/create-application.dto';
import {
  ReviewerQueueQueryDto,
  reviewerQueueStatuses,
} from './dto/reviewer-queue-query.dto';
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
  @ApiBody({ type: CreateApplicationDto })
  @ApiResponse({ status: 201, description: 'Draft application created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only applicants can create applications.' })
  create(
    @CurrentUser() currentUser: AuthUser,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(currentUser, createApplicationDto);
  }

  @Get('my')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'List applications owned by the current applicant.' })
  @ApiResponse({ status: 200, description: 'Applications returned.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only applicants can access this endpoint.' })
  listMyApplications(@CurrentUser() currentUser: AuthUser) {
    return this.applicationsService.listMyApplications(currentUser);
  }

  @Get('reviewer/queue')
  @Roles(Role.REVIEWER)
  @ApiOperation({ summary: 'List reviewer queue applications with filters and pagination.' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: reviewerQueueStatuses,
    description: 'Optional workflow status filter.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: Category,
    description: 'Optional application category filter.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Optional text search across title, description, owner name, and owner email.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number.',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Items per page.',
  })
  @ApiResponse({ status: 200, description: 'Reviewer queue returned.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only reviewers can access this endpoint.' })
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
  @ApiParam({ name: 'id', description: 'Application ID.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Application returned.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Forbidden for this user.' })
  @ApiResponse({ status: 404, description: 'Application not found.' })
  getById(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.getById(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'Update a draft or returned application owned by the current applicant.' })
  @ApiParam({ name: 'id', description: 'Application ID.', format: 'uuid' })
  @ApiBody({ type: UpdateApplicationDto })
  @ApiResponse({ status: 200, description: 'Application updated.' })
  @ApiResponse({ status: 400, description: 'Validation failed or transition is not allowed.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only the owner applicant can update.' })
  @ApiResponse({ status: 404, description: 'Application not found.' })
  update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateApplicationDto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(currentUser, id, updateApplicationDto);
  }

  @Post(':id/submit')
  @Roles(Role.APPLICANT)
  @ApiOperation({ summary: 'Submit a draft application owned by the current applicant.' })
  @ApiParam({ name: 'id', description: 'Application ID.', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Application submitted.' })
  @ApiResponse({ status: 400, description: 'Illegal workflow transition.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only the owner applicant can submit.' })
  @ApiResponse({ status: 404, description: 'Application not found.' })
  submit(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.submit(currentUser, id);
  }

  @Post(':id/transition')
  @Roles(Role.REVIEWER)
  @ApiOperation({ summary: 'Transition an application as a reviewer.' })
  @ApiParam({ name: 'id', description: 'Application ID.', format: 'uuid' })
  @ApiBody({ type: ReviewerTransitionDto })
  @ApiResponse({ status: 201, description: 'Application transitioned.' })
  @ApiResponse({ status: 400, description: 'Illegal transition or missing required comment.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Only reviewers can transition applications.' })
  @ApiResponse({ status: 404, description: 'Application not found.' })
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
