import { join } from "node:path";
import { App, CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Policy, PolicyStatement, Role, ServicePrincipal, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { CfnScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Queue, DeadLetterQueue } from "aws-cdk-lib/aws-sqs";

const app = new App();
const stack = new Stack(app, "FinanceWorker", {
  env: { region: process.env.AWS_REGION || "ap-northeast-2" },
});

const workerDlq = new Queue(stack, "WorkerDLQ", {
  queueName: "finance-worker-dlq",
  retentionPeriod: Duration.days(14),
  removalPolicy: RemovalPolicy.RETAIN,
});

const schedulerDeliveryDlq = new Queue(stack, "SchedulerDeliveryDLQ", {
  queueName: "finance-scheduler-delivery-dlq",
  retentionPeriod: Duration.days(14),
  removalPolicy: RemovalPolicy.RETAIN,
});

const workerQueue = new Queue(stack, "WorkerQueue", {
  queueName: "finance-worker-queue",
  visibilityTimeout: Duration.seconds(1080),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: workerDlq,
    maxReceiveCount: 5,
  } as DeadLetterQueue,
  removalPolicy: RemovalPolicy.RETAIN,
});

/** Single-table layout matching app `FINANCE_DATA_TABLE` (bots, messages, routines, runs). */
const financeDataTableName = app.node.tryGetContext("financeDataTableName");
const financeDataTable = new Table(stack, "FinanceData", {
  ...(typeof financeDataTableName === "string" && financeDataTableName
    ? { tableName: financeDataTableName }
    : {}),
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});

financeDataTable.addGlobalSecondaryIndex({
  indexName: "ByOwnerStatus",
  partitionKey: { name: "ownerId", type: AttributeType.STRING },
  sortKey: { name: "statusCreatedAt", type: AttributeType.STRING },
});

financeDataTable.addGlobalSecondaryIndex({
  indexName: "ByRoutineScheduled",
  partitionKey: { name: "routineId", type: AttributeType.STRING },
  sortKey: { name: "scheduledAt", type: AttributeType.STRING },
});

const scheduleGroup = new CfnScheduleGroup(stack, "FinanceScheduleGroup", {
  name: "finance-routines",
});

const schedulerRole = new Role(stack, "SchedulerRole", {
  assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
});

schedulerRole.addToPolicy(
  new PolicyStatement({
    actions: ["sqs:SendMessage"],
    resources: [workerQueue.queueArn],
  }),
);

schedulerRole.addToPolicy(
  new PolicyStatement({
    actions: ["sqs:SendMessage"],
    resources: [schedulerDeliveryDlq.queueArn],
  }),
);

const workerRole = new Role(stack, "WorkerRole", {
  assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
  managedPolicies: [
    ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
  ],
});

const openRouterSecretName =
  (app.node.tryGetContext("openRouterSecretName") as string | undefined) || "finance/openrouter-api-key";
const openDartSecretName =
  (app.node.tryGetContext("openDartSecretName") as string | undefined) || "finance/opendart-api-key";

const openRouterSecret = Secret.fromSecretNameV2(stack, "OpenRouterSecret", openRouterSecretName);
const openDartSecret = Secret.fromSecretNameV2(stack, "OpenDartSecret", openDartSecretName);

const workerPolicy = new Policy(stack, "WorkerPolicy", {
  statements: [
    new PolicyStatement({
      sid: "DynamoDBFinanceData",
      actions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:TransactWriteItems",
        "dynamodb:TransactGetItems",
      ],
      resources: [financeDataTable.tableArn, `${financeDataTable.tableArn}/index/*`],
    }),
    new PolicyStatement({
      sid: "SQSWorkerQueue",
      actions: [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility",
      ],
      resources: [workerQueue.queueArn],
    }),
    new PolicyStatement({
      sid: "SQSSendWorkerDLQ",
      actions: ["sqs:SendMessage"],
      resources: [workerDlq.queueArn],
    }),
  ],
});
workerPolicy.attachToRole(workerRole);

openRouterSecret.grantRead(workerRole);
openDartSecret.grantRead(workerRole);

const budgetTableArn = app.node.tryGetContext("budgetTableArn");
if (typeof budgetTableArn === "string" && budgetTableArn) {
  new Policy(stack, "WorkerBudgetPolicy", {
    statements: [
      new PolicyStatement({
        sid: "BudgetAccess",
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"],
        resources: [budgetTableArn],
      }),
    ],
  }).attachToRole(workerRole);
}

const vercelRuntimeRoleName = app.node.tryGetContext("vercelRuntimeRoleName");
if (typeof vercelRuntimeRoleName === "string" && vercelRuntimeRoleName) {
  const vercelRole = Role.fromRoleName(stack, "VercelRuntimeRole", vercelRuntimeRoleName);
  const schedulerApiPolicy = new Policy(stack, "VercelSchedulerPolicy", {
    statements: [
      new PolicyStatement({
        actions: [
          "scheduler:CreateSchedule",
          "scheduler:UpdateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
        ],
        resources: [`arn:aws:scheduler:*:*:schedule/finance-routines/*`],
      }),
      new PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [schedulerRole.roleArn],
        conditions: {
          StringEquals: { "iam:PassedToService": "scheduler.amazonaws.com" },
        },
      }),
    ],
  });
  schedulerApiPolicy.attachToRole(vercelRole);

  new Policy(stack, "VercelFinanceDataPolicy", {
    statements: [
      new PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:TransactWriteItems",
        ],
        resources: [financeDataTable.tableArn, `${financeDataTable.tableArn}/index/*`],
      }),
    ],
  }).attachToRole(vercelRole);
}

const workerFunction = new NodejsFunction(stack, "WorkerFunction", {
  functionName: "finance-agent-worker",
  entry: join(__dirname, "lambda/finance-worker/handler.ts"),
  handler: "handler",
  runtime: Runtime.NODEJS_22_X,
  architecture: Architecture.ARM_64,
  timeout: Duration.seconds(180),
  memorySize: 512,
  role: workerRole,
  reservedConcurrentExecutions: 5,
  environment: {
    FINANCE_DATA_TABLE: financeDataTable.tableName,
    OPENROUTER_SECRET_ARN: openRouterSecret.secretArn,
    OPENDART_SECRET_ARN: openDartSecret.secretArn,
    NODE_OPTIONS: "--enable-source-maps",
  },
  bundling: {
    minify: true,
    sourceMap: true,
    target: "node22",
  },
});

workerFunction.addEventSource(
  new SqsEventSource(workerQueue, {
    batchSize: 1,
    maxBatchingWindow: Duration.seconds(0),
    reportBatchItemFailures: true,
  }),
);

new CfnOutput(stack, "FinanceDataTableName", { value: financeDataTable.tableName });
new CfnOutput(stack, "FinanceDataTableArn", { value: financeDataTable.tableArn });
new CfnOutput(stack, "WorkerQueueUrl", { value: workerQueue.queueUrl });
new CfnOutput(stack, "WorkerQueueArn", { value: workerQueue.queueArn });
new CfnOutput(stack, "WorkerDLQUrl", { value: workerDlq.queueUrl });
new CfnOutput(stack, "WorkerDLQArn", { value: workerDlq.queueArn });
new CfnOutput(stack, "SchedulerDeliveryDLQUrl", { value: schedulerDeliveryDlq.queueUrl });
new CfnOutput(stack, "SchedulerDeliveryDLQArn", { value: schedulerDeliveryDlq.queueArn });
new CfnOutput(stack, "SchedulerRoleArn", { value: schedulerRole.roleArn });
new CfnOutput(stack, "SchedulerGroupName", { value: scheduleGroup.name! });
new CfnOutput(stack, "WorkerFunctionArn", { value: workerFunction.functionArn });
new CfnOutput(stack, "WorkerRoleArn", { value: workerRole.roleArn });
new CfnOutput(stack, "VercelSchedulerTargetQueueArn", { value: workerQueue.queueArn });
new CfnOutput(stack, "VercelSchedulerTargetDlqArn", { value: schedulerDeliveryDlq.queueArn });
new CfnOutput(stack, "VercelFinanceSchedulerMode", { value: "aws" });

app.synth();
