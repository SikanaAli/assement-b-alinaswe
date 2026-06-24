import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { configureApp } from '../src/app.config';
import { PrismaService } from '../src/prisma/prisma.service';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
};

describe('Applications e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL is required for e2e tests.');
    }

    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET ||= 'test-secret';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.application.deleteMany();

    const passwordHash = await bcrypt.hash('password123', 10);

    await prisma.user.upsert({
      where: { email: 'applicant@example.com' },
      update: {
        name: 'Applicant',
        passwordHash,
        role: Role.APPLICANT,
      },
      create: {
        name: 'Applicant',
        email: 'applicant@example.com',
        passwordHash,
        role: Role.APPLICANT,
      },
    });

    await prisma.user.upsert({
      where: { email: 'reviewer@example.com' },
      update: {
        name: 'Reviewer',
        passwordHash,
        role: Role.REVIEWER,
      },
      create: {
        name: 'Reviewer',
        email: 'reviewer@example.com',
        passwordHash,
        role: Role.REVIEWER,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks an applicant from approving their own application', async () => {
    const applicantToken = await loginAs('applicant@example.com');
    const applicationId = await createApplication(applicantToken);

    await submitApplication(applicantToken, applicationId);

    const response = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/transition`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        status: 'APPROVED',
        comment: 'Trying to self-approve',
      });

    expect(response.status).toBe(403);
  });

  it('allows a reviewer to approve a submitted application and records both audit transitions', async () => {
    const applicantToken = await loginAs('applicant@example.com');
    const applicationId = await createApplication(applicantToken);

    await submitApplication(applicantToken, applicationId);

    const reviewerToken = await loginAs('reviewer@example.com');
    const approveResponse = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/transition`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        status: 'APPROVED',
        comment: 'Looks good',
      });

    expect(approveResponse.status).toBe(201);
    expect(approveResponse.body.status).toBe('APPROVED');

    const getResponse = await request(app.getHttpServer())
      .get(`/applications/${applicationId}`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(getResponse.status).toBe(200);
    expect(
      getResponse.body.auditLogs.map(
        (auditLog: { oldStatus: string; newStatus: string }) => ({
          oldStatus: auditLog.oldStatus,
          newStatus: auditLog.newStatus,
        }),
      ),
    ).toEqual([
      { oldStatus: 'DRAFT', newStatus: 'SUBMITTED' },
      { oldStatus: 'SUBMITTED', newStatus: 'APPROVED' },
    ]);
  });

  it('returns 400 when a reviewer rejects without a comment', async () => {
    const applicantToken = await loginAs('applicant@example.com');
    const applicationId = await createApplication(applicantToken);

    await submitApplication(applicantToken, applicationId);

    const reviewerToken = await loginAs('reviewer@example.com');
    const response = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/transition`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        status: 'REJECTED',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('COMMENT_REQUIRED');
  });

  it('returns 403 when an applicant tries to edit after submitting', async () => {
    const applicantToken = await loginAs('applicant@example.com');
    const applicationId = await createApplication(applicantToken);

    await submitApplication(applicantToken, applicationId);

    const response = await request(app.getHttpServer())
      .patch(`/applications/${applicationId}`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        title: 'Edited after submit',
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('APPLICATION_EDIT_FORBIDDEN');
  });

  async function loginAs(email: string) {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email,
      password: 'password123',
    });

    expect(response.status).toBe(201);

    return (response.body as LoginResponse).accessToken;
  }

  async function createApplication(token: string) {
    const response = await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Budget Increase Request',
        category: 'FINANCE',
        description: 'Need approval for additional travel budget.',
        amount: 1250,
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DRAFT');

    return response.body.id as string;
  }

  async function submitApplication(token: string, applicationId: string) {
    const response = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('SUBMITTED');
  }
});
