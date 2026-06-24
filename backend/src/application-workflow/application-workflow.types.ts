import { Role, Status } from '@prisma/client';

export type ApplicationEditContext = {
  actorId: string;
  actorRole: Role;
  applicationOwnerId: string;
  currentStatus: Status;
};

export type ApplicationTransitionContext = {
  actorId: string;
  actorRole: Role;
  applicationOwnerId: string;
  currentStatus: Status;
  targetStatus: Status;
  comment?: string | null;
};

