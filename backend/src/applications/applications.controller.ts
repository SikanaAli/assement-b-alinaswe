import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationsService } from './applications.service';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(Role.APPLICANT)
  create(
    @CurrentUser() currentUser: AuthUser,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(currentUser, createApplicationDto);
  }

  @Get('my')
  @Roles(Role.APPLICANT)
  listMyApplications(@CurrentUser() currentUser: AuthUser) {
    return this.applicationsService.listMyApplications(currentUser);
  }

  @Get(':id')
  @Roles(Role.APPLICANT, Role.REVIEWER)
  getById(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.getById(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.APPLICANT)
  update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateApplicationDto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(currentUser, id, updateApplicationDto);
  }

  @Post(':id/submit')
  @Roles(Role.APPLICANT)
  submit(@CurrentUser() currentUser: AuthUser, @Param('id') id: string) {
    return this.applicationsService.submit(currentUser, id);
  }
}

