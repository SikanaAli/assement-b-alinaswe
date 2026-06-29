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
import {
  ReviewerQueueQueryDto,
  reviewerQueueStatuses,
} from './dto/reviewer-queue-query.dto';
import { ReviewerTransitionDto } from './dto/reviewer-transition.dto';
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

  reviewerQueue(
    currentUser: AuthUser,
    reviewerQueueQueryDto: ReviewerQueueQueryDto,
  ) {
    this.assertReviewerRole(currentUser);

    const page = reviewerQueueQueryDto.page ?? 1;
    const pageSize = reviewerQueueQueryDto.pageSize ?? 10;
    const search = reviewerQueueQueryDto.search?.trim();

    const where: Prisma.ApplicationWhereInput = {
      status: reviewerQueueQueryDto.status
        ? (reviewerQueueQueryDto.status as Status)
        : {
            in: reviewerQueueStatuses as unknown as Status[],
          },
      ...(reviewerQueueQueryDto.category
        ? { category: reviewerQueueQueryDto.category }
        : {}),
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                owner: {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                owner: {
                  email: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    return this.prisma.$transaction(async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.application.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            category: true,
            amount: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        transaction.application.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    });
  }

  async getById(currentUser: AuthUser, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
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

    const updateData: Prisma.ApplicationUpdateInput = {
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
      ...(application.status === Status.RETURNED ? { status: Status.DRAFT } : {}),
    };

    return this.prisma.$transaction(async (transaction) => {
      const updatedApplication = await transaction.application.update({
        where: { id },
        data: updateData,
        include: {
          auditLogs: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (application.status === Status.RETURNED) {
        await transaction.auditLog.create({
          data: {
            applicationId: application.id,
            actorId: currentUser.id,
            oldStatus: Status.RETURNED,
            newStatus: Status.DRAFT,
          },
        });
      }

      return updatedApplication;
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

  async reviewerTransition(
    currentUser: AuthUser,
    id: string,
    reviewerTransitionDto: ReviewerTransitionDto,
  ) {
    this.assertReviewerRole(currentUser);

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
      targetStatus: reviewerTransitionDto.status as Status,
      comment: reviewerTransitionDto.comment,
    });

    return this.prisma.$transaction(async (transaction) => {
      const updatedApplication = await transaction.application.update({
        where: { id },
        data: {
          status: reviewerTransitionDto.status as Status,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          applicationId: application.id,
          actorId: currentUser.id,
          oldStatus: application.status,
          newStatus: reviewerTransitionDto.status as Status,
          comment: reviewerTransitionDto.comment,
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

  private assertReviewerRole(currentUser: AuthUser) {
    if (currentUser.role !== Role.REVIEWER) {
      throw this.createForbiddenError(
        'Only reviewers can access reviewer application endpoints.',
      );
    }
  }
}
