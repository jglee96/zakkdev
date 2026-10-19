import "server-only";

export type ScheduleInput = {
  ownerId: string;
  routineId: string;
  routineVersion: number;
};

export type ScheduleTarget = {
  queueArn: string;
  roleArn: string;
  dlqArn: string;
};

export type CreateScheduleParams = {
  name: string;
  scheduleExpression: string;
  timezone: string;
  input: ScheduleInput;
  target: ScheduleTarget;
  clientToken?: string;
};

export type UpdateScheduleParams = {
  name: string;
  scheduleExpression?: string;
  timezone?: string;
  input?: ScheduleInput;
  enabled?: boolean;
};

export type ScheduleInfo = {
  name: string;
  arn: string;
  scheduleExpression: string;
  timezone: string;
  state: "ENABLED" | "DISABLED";
  input: ScheduleInput;
  createdAt: Date;
  lastModifiedAt: Date;
};

export type CreateScheduleResult =
  | { success: true; arn: string }
  | { success: false; error: string; code: "CONFLICT" | "VALIDATION" | "LIMIT" | "UNKNOWN" };

export type UpdateScheduleResult =
  | { success: true; arn: string }
  | { success: false; error: string; code: "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNKNOWN" };

export type DeleteScheduleResult =
  | { success: true }
  | { success: false; error: string; code: "NOT_FOUND" | "UNKNOWN" };

export type GetScheduleResult =
  | { success: true; schedule: ScheduleInfo }
  | { success: false; error: string; code: "NOT_FOUND" | "UNKNOWN" };

export interface SchedulerClient {
  createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult>;
  updateSchedule(params: UpdateScheduleParams): Promise<UpdateScheduleResult>;
  deleteSchedule(name: string): Promise<DeleteScheduleResult>;
  getSchedule(name: string): Promise<GetScheduleResult>;
  pauseSchedule(name: string): Promise<UpdateScheduleResult>;
  resumeSchedule(name: string): Promise<UpdateScheduleResult>;
}

export function generateSchedulerName(ownerId: string, routineId: string): string {
  const ownerPrefix = ownerId.slice(0, 8);
  const routineSuffix = routineId.slice(0, 8);
  return `fin-${ownerPrefix}-${routineSuffix}`;
}
