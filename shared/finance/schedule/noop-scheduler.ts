import type {
  SchedulerClient,
  CreateScheduleParams,
  UpdateScheduleParams,
  CreateScheduleResult,
  UpdateScheduleResult,
  DeleteScheduleResult,
  GetScheduleResult,
} from "./types";

/** In-process scheduler that always succeeds (no EventBridge). For local UI without AWS. */
export function createNoopSchedulerClient(): SchedulerClient {
  return {
    async createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
      return { success: true, arn: `noop:schedule:${params.name}` };
    },
    async updateSchedule(params: UpdateScheduleParams): Promise<UpdateScheduleResult> {
      return { success: true, arn: `noop:schedule:${params.name}` };
    },
    async deleteSchedule(_name: string): Promise<DeleteScheduleResult> {
      return { success: true };
    },
    async getSchedule(name: string): Promise<GetScheduleResult> {
      return {
        success: true,
        schedule: {
          name,
          arn: `noop:schedule:${name}`,
          scheduleExpression: "cron(0 0 * * ? *)",
          timezone: "UTC",
          state: "ENABLED",
          input: { ownerId: "", routineId: "", routineVersion: 0 },
          createdAt: new Date(),
          lastModifiedAt: new Date(),
        },
      };
    },
    async pauseSchedule(name: string): Promise<UpdateScheduleResult> {
      return { success: true, arn: `noop:schedule:${name}` };
    },
    async resumeSchedule(name: string): Promise<UpdateScheduleResult> {
      return { success: true, arn: `noop:schedule:${name}` };
    },
  };
}
