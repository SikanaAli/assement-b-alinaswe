import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, Status } from '@prisma/client';
import { ApplicationWorkflowService } from '../application-workflow/application-workflow.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationWorkflowService: ApplicationWorkflowService,
  ) {}

  create(currentUser: AuthUser, createApplicationDto: CreateApplicationDto) {
    return this.prisma.application.create({
      data: {
        ownerId: currentUser.id,
        title: createApplicationDto.title,
        category: createApplicationDto.category,
        description: createApplicationDto.description,
        amount: this.toDecimal(createApplicationDto.amount),
      },
      select: this.listSelect,
    });
  }

  listMyApplications(currentUser: AuthUser) {
    return this.prisma.application.findMany({
      where: { ownerId: currentUser.id },
      orderBy: { createdAt: 'desc' },
      select: this.listSelect,
    });
  }

  async getById(currentUser: AuthUser, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw this.createNotFoundError(id);
    }

    if (
      currentUser.role === Role.APPLICANT &&
      application.ownerId !== currentUser.id
    ) {
      throw this.createForbiddenError(
        'Applicants can only view their own applications.',
      );
    }

    return application;
  }

  async update(
    currentUser: AuthUser,
    id: string,
    updateApplicationDto: UpdateApplicationDto,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      throw this.createNotFoundError(id);
    }

    this.applicationWorkflowService.assertCanEditApplication({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      applicationOwnerId: application.ownerId,
      currentStatus: application.status,
    });

    return this.prisma.application.update({
      where: { id },
      data: {
        ...(updateApplicationDto.title !== undefined
          ? { title: updateApplicationDto.title }
          : {}),
        ...(updateApplicationDto.category !== undefined
          ? { category: updateApplicationDto.category }
          : {}),
        ...(updateApplicationDto.description !== undefined
          ? { description: updateApplicationDto.description }
          : {}),
        ...(updateApplicationDto.amount !== undefined
          ? { amount: this.toDecimal(updateApplicationDto.amount) }
          : {}),
      },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async submit(currentUser: AuthUser, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      throw this.createNotFoundError(id);
    }

    this.applicationWorkflowService.assertTransitionAllowed({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      applicationOwnerId: application.ownerId,
      currentStatus: application.status,
      targetStatus: Status.SUBMITTED,
    });

    return this.prisma.$transaction(async (transaction) => {
      const updatedApplication = await transaction.application.update({
        where: { id },
        data: {
          status: Status.SUBMITTED,
        },
      });

      await transaction.auditLog.create({
        data: {
          applicationId: application.id,
          actorId: currentUser.id,
          oldStatus: application.status,
          newStatus: Status.SUBMITTED,
        },
      });

      return updatedApplication;
    });
  }

  private get listSelect() {
    return {
      id: true,
      ownerId: true,
      title: true,
      category: true,
      description: true,
      amount: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ApplicationSelect;
  }

  private createForbiddenError(message: string) {
    return new ForbiddenException({
      statusCode: 403,
      code: 'FORBIDDEN',
      message,
    });
  }

  private createNotFoundError(id: string) {
    return new NotFoundException({
      statusCode: 404,
      code: 'APPLICATION_NOT_FOUND',
      message: `Application ${id} was not found.`,
    });
  }

  private toDecimal(amount?: number) {
    return amount !== undefined ? new Prisma.Decimal(amount) : undefined;
  }
}

