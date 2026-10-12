import type {
  SchedulerClient,
  CreateScheduleParams,
  UpdateScheduleParams,
  CreateScheduleResult,
  UpdateScheduleResult,
  DeleteScheduleResult,
  GetScheduleResult,
  ScheduleInfo,
} from "./types";

export type FakeScheduleRecord = ScheduleInfo & {
  target: {
    queueArn: string;
    roleArn: string;
    dlqArn: string;
  };
};

export type FakeSchedulerOptions = {
  simulateConflictOnCreate?: boolean;
  simulateLimitOnCreate?: boolean;
  simulateErrorOnUpdate?: boolean;
  simulateErrorOnDelete?: boolean;
  delayMs?: number;
};

export function createFakeSchedulerClient(
  options: FakeSchedulerOptions = {}
): SchedulerClient & {
  getSchedules(): Map<string, FakeScheduleRecord>;
  clearSchedules(): void;
  setOptions(opts: FakeSchedulerOptions): void;
  triggerSchedule(name: string): { routineId: string; routineVersion: number; scheduledAt: string } | null;
} {
  const schedules = new Map<string, FakeScheduleRecord>();
  let currentOptions = { ...options };

  async function maybeDelay() {
    if (currentOptions.delayMs && currentOptions.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, currentOptions.delayMs));
    }
  }

  const client: SchedulerClient & {
    getSchedules(): Map<string, FakeScheduleRecord>;
    clearSchedules(): void;
    setOptions(opts: FakeSchedulerOptions): void;
    triggerSchedule(name: string): { routineId: string; routineVersion: number; scheduledAt: string } | null;
  } = {
    async createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
      await maybeDelay();

      if (currentOptions.simulateConflictOnCreate) {
        return { success: false, error: "Schedule already exists", code: "CONFLICT" };
      }

      if (currentOptions.simulateLimitOnCreate) {
        return { success: false, error: "Quota exceeded", code: "LIMIT" };
      }

      if (schedules.has(params.name)) {
        return { success: false, error: "Schedule already exists", code: "CONFLICT" };
      }

      const now = new Date();
      const arn = `arn:aws:scheduler:fake-region:123456789012:schedule/default/${params.name}`;

      schedules.set(params.name, {
        name: params.name,
        arn,
        scheduleExpression: params.scheduleExpression,
        timezone: params.timezone,
        state: "ENABLED",
        input: params.input,
        createdAt: now,
        lastModifiedAt: now,
        target: params.target,
      });

      return { success: true, arn };
    },

    async updateSchedule(params: UpdateScheduleParams): Promise<UpdateScheduleResult> {
      await maybeDelay();

      if (currentOptions.simulateErrorOnUpdate) {
        return { success: false, error: "Simulated error", code: "UNKNOWN" };
      }

      const existing = schedules.get(params.name);
      if (!existing) {
        return { success: false, error: "Schedule not found", code: "NOT_FOUND" };
      }

      const updated: FakeScheduleRecord = {
        ...existing,
        scheduleExpression: params.scheduleExpression || existing.scheduleExpression,
        timezone: params.timezone || existing.timezone,
        input: params.input || existing.input,
        state: params.enabled === false ? "DISABLED" : "ENABLED",
        lastModifiedAt: new Date(),
      };

      schedules.set(params.name, updated);

      return { success: true, arn: existing.arn };
    },

    async deleteSchedule(name: string): Promise<DeleteScheduleResult> {
      await maybeDelay();

      if (currentOptions.simulateErrorOnDelete) {
        return { success: false, error: "Simulated error", code: "UNKNOWN" };
      }

      schedules.delete(name);
      return { success: true };
    },

    async getSchedule(name: string): Promise<GetScheduleResult> {
      await maybeDelay();

      const schedule = schedules.get(name);
      if (!schedule) {
        return { success: false, error: "Schedule not found", code: "NOT_FOUND" };
      }

      return {
        success: true,
        schedule: {
          name: schedule.name,
          arn: schedule.arn,
          scheduleExpression: schedule.scheduleExpression,
          timezone: schedule.timezone,
          state: schedule.state,
          input: schedule.input,
          createdAt: schedule.createdAt,
          lastModifiedAt: schedule.lastModifiedAt,
        },
      };
    },

    async pauseSchedule(name: string): Promise<UpdateScheduleResult> {
      return this.updateSchedule({ name, enabled: false });
    },

    async resumeSchedule(name: string): Promise<UpdateScheduleResult> {
      return this.updateSchedule({ name, enabled: true });
    },

    getSchedules() {
      return schedules;
    },

    clearSchedules() {
      schedules.clear();
    },

    setOptions(opts: FakeSchedulerOptions) {
      currentOptions = { ...opts };
    },

    triggerSchedule(name: string) {
      const schedule = schedules.get(name);
      if (!schedule || schedule.state !== "ENABLED") {
        return null;
      }

      return {
        routineId: schedule.input.routineId,
        routineVersion: schedule.input.routineVersion,
        scheduledAt: new Date().toISOString(),
      };
    },
  };

  return client;
}
