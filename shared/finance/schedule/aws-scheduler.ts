import "server-only";
import {
  SchedulerClient as AWSSchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ConflictException,
  ResourceNotFoundException,
  ValidationException,
  ServiceQuotaExceededException,
  FlexibleTimeWindowMode,
  ScheduleState,
} from "@aws-sdk/client-scheduler";
import type {
  SchedulerClient,
  CreateScheduleParams,
  UpdateScheduleParams,
  CreateScheduleResult,
  UpdateScheduleResult,
  DeleteScheduleResult,
  GetScheduleResult,
  ScheduleInput,
} from "./types";
import { applyFinanceAwsClientConfig } from "../aws/credentials";

export type AWSSchedulerConfig = {
  region: string;
  groupName?: string;
  env?: Partial<NodeJS.ProcessEnv>;
};

export function createAWSSchedulerClient(config: AWSSchedulerConfig): SchedulerClient {
  const client = new AWSSchedulerClient(
    applyFinanceAwsClientConfig({ region: config.region }, config.env ?? process.env),
  );
  const groupName = config.groupName || "default";

  return {
    async createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
      const messageBody = JSON.stringify({
        ownerId: params.input.ownerId,
        routineId: params.input.routineId,
        routineVersion: params.input.routineVersion,
        scheduledAt: "<aws.scheduler.scheduled-time>",
      });

      try {
        const result = await client.send(
          new CreateScheduleCommand({
            Name: params.name,
            GroupName: groupName,
            ScheduleExpression: params.scheduleExpression,
            ScheduleExpressionTimezone: params.timezone,
            FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
            Target: {
              Arn: params.target.queueArn,
              RoleArn: params.target.roleArn,
              Input: messageBody,
              DeadLetterConfig: {
                Arn: params.target.dlqArn,
              },
            },
            State: ScheduleState.ENABLED,
            ClientToken: params.clientToken,
          })
        );

        return { success: true, arn: result.ScheduleArn! };
      } catch (error) {
        if (error instanceof ConflictException) {
          return { success: false, error: error.message, code: "CONFLICT" };
        }
        if (error instanceof ValidationException) {
          return { success: false, error: error.message, code: "VALIDATION" };
        }
        if (error instanceof ServiceQuotaExceededException) {
          return { success: false, error: error.message, code: "LIMIT" };
        }
        return { success: false, error: String(error), code: "UNKNOWN" };
      }
    },

    async updateSchedule(params: UpdateScheduleParams): Promise<UpdateScheduleResult> {
      try {
        const getResult = await client.send(
          new GetScheduleCommand({
            Name: params.name,
            GroupName: groupName,
          })
        );

        const newInput = params.input || {
          ownerId: "",
          routineId: "",
          routineVersion: 0,
        };

        try {
          const parsed = JSON.parse(getResult.Target?.Input || "{}");
          if (!params.input) {
            newInput.ownerId = parsed.ownerId || "";
            newInput.routineId = parsed.routineId || "";
            newInput.routineVersion = parsed.routineVersion || 0;
          }
        } catch {
          // ignore parse errors
        }

        const messageBody = JSON.stringify({
          ownerId: newInput.ownerId,
          routineId: newInput.routineId,
          routineVersion: newInput.routineVersion,
          scheduledAt: "<aws.scheduler.scheduled-time>",
        });

        const result = await client.send(
          new UpdateScheduleCommand({
            Name: params.name,
            GroupName: groupName,
            ScheduleExpression: params.scheduleExpression || getResult.ScheduleExpression,
            ScheduleExpressionTimezone: params.timezone || getResult.ScheduleExpressionTimezone,
            FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
            Target: {
              Arn: getResult.Target!.Arn!,
              RoleArn: getResult.Target!.RoleArn!,
              Input: messageBody,
              DeadLetterConfig: getResult.Target?.DeadLetterConfig,
            },
            State: params.enabled === false ? ScheduleState.DISABLED : ScheduleState.ENABLED,
          })
        );

        return { success: true, arn: result.ScheduleArn! };
      } catch (error) {
        if (error instanceof ResourceNotFoundException) {
          return { success: false, error: error.message, code: "NOT_FOUND" };
        }
        if (error instanceof ConflictException) {
          return { success: false, error: error.message, code: "CONFLICT" };
        }
        if (error instanceof ValidationException) {
          return { success: false, error: error.message, code: "VALIDATION" };
        }
        return { success: false, error: String(error), code: "UNKNOWN" };
      }
    },

    async deleteSchedule(name: string): Promise<DeleteScheduleResult> {
      try {
        await client.send(
          new DeleteScheduleCommand({
            Name: name,
            GroupName: groupName,
          })
        );
        return { success: true };
      } catch (error) {
        if (error instanceof ResourceNotFoundException) {
          return { success: true };
        }
        return { success: false, error: String(error), code: "UNKNOWN" };
      }
    },

    async getSchedule(name: string): Promise<GetScheduleResult> {
      try {
        const result = await client.send(
          new GetScheduleCommand({
            Name: name,
            GroupName: groupName,
          })
        );

        const inputStr = result.Target?.Input;
        let input: ScheduleInput = { ownerId: "", routineId: "", routineVersion: 0 };
        if (inputStr) {
          try {
            const parsed = JSON.parse(inputStr);
            input = {
              ownerId: parsed.ownerId || "",
              routineId: parsed.routineId || "",
              routineVersion: parsed.routineVersion || 0,
            };
          } catch {
            // ignore parse errors
          }
        }

        return {
          success: true,
          schedule: {
            name: result.Name!,
            arn: result.Arn!,
            scheduleExpression: result.ScheduleExpression!,
            timezone: result.ScheduleExpressionTimezone || "UTC",
            state: result.State === ScheduleState.ENABLED ? "ENABLED" : "DISABLED",
            input,
            createdAt: result.CreationDate!,
            lastModifiedAt: result.LastModificationDate!,
          },
        };
      } catch (error) {
        if (error instanceof ResourceNotFoundException) {
          return { success: false, error: "Schedule not found", code: "NOT_FOUND" };
        }
        return { success: false, error: String(error), code: "UNKNOWN" };
      }
    },

    async pauseSchedule(name: string): Promise<UpdateScheduleResult> {
      return this.updateSchedule({ name, enabled: false });
    },

    async resumeSchedule(name: string): Promise<UpdateScheduleResult> {
      return this.updateSchedule({ name, enabled: true });
    },
  };
}
