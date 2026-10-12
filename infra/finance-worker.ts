import { App, CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Policy, PolicyStatement, Role, ServicePrincipal, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { Runtime, Function as LambdaFunction, Code, Architecture } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue, DeadLetterQueue } from "aws-cdk-lib/aws-sqs";

const app = new App();
const stack = new Stack(app, "FinanceWorker", { env: { region: process.env.AWS_REGION || "ap-northeast-2" } });

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

const runsTable = new Table(stack, "AgentRuns", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});

runsTable.addGlobalSecondaryIndex({
  indexName: "ByOwnerStatus",
  partitionKey: { name: "ownerId", type: AttributeType.STRING },
  sortKey: { name: "statusCreatedAt", type: AttributeType.STRING },
});

runsTable.addGlobalSecondaryIndex({
  indexName: "ByRoutineScheduled",
  partitionKey: { name: "routineId", type: AttributeType.STRING },
  sortKey: { name: "scheduledAt", type: AttributeType.STRING },
});

const routinesTable = new Table(stack, "Routines", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "deletedExpiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});

routinesTable.addGlobalSecondaryIndex({
  indexName: "ByOwnerStatus",
  partitionKey: { name: "ownerId", type: AttributeType.STRING },
  sortKey: { name: "statusCreatedAt", type: AttributeType.STRING },
});

const workerRole = new Role(stack, "WorkerRole", {
  assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
  managedPolicies: [
    ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
  ],
});

const workerPolicy = new Policy(stack, "WorkerPolicy", {
  statements: [
    new PolicyStatement({
      sid: "DynamoDBAccess",
      actions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:TransactWriteItems",
        "dynamodb:TransactGetItems",
      ],
      resources: [
        runsTable.tableArn,
        `${runsTable.tableArn}/index/*`,
        routinesTable.tableArn,
        `${routinesTable.tableArn}/index/*`,
      ],
    }),
    new PolicyStatement({
      sid: "SQSAccess",
      actions: [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility",
      ],
      resources: [workerQueue.queueArn],
    }),
    new PolicyStatement({
      sid: "SQSSendDLQ",
      actions: ["sqs:SendMessage"],
      resources: [workerDlq.queueArn],
    }),
  ],
});
workerPolicy.attachToRole(workerRole);

const schedulerRole = new Role(stack, "SchedulerRole", {
  assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
});

const schedulerPolicy = new Policy(stack, "SchedulerPolicy", {
  statements: [
    new PolicyStatement({
      sid: "SQSSend",
      actions: ["sqs:SendMessage"],
      resources: [workerQueue.queueArn],
    }),
  ],
});
schedulerPolicy.attachToRole(schedulerRole);

const workerFunction = new LambdaFunction(stack, "WorkerFunction", {
  functionName: "finance-agent-worker",
  runtime: Runtime.NODEJS_22_X,
  architecture: Architecture.ARM_64,
  handler: "index.handler",
  code: Code.fromInline(`
    exports.handler = async (event) => {
      // Placeholder - actual worker code is deployed separately
      console.log('Worker event:', JSON.stringify(event));
      return { batchItemFailures: [] };
    };
  `),
  timeout: Duration.seconds(180),
  memorySize: 512,
  role: workerRole,
  environment: {
    RUNS_TABLE: runsTable.tableName,
    ROUTINES_TABLE: routinesTable.tableName,
    WORKER_QUEUE_URL: workerQueue.queueUrl,
    WORKER_DLQ_URL: workerDlq.queueUrl,
    NODE_OPTIONS: "--enable-source-maps",
  },
  reservedConcurrentExecutions: 5,
});

workerFunction.addEventSource(
  new SqsEventSource(workerQueue, {
    batchSize: 1,
    maxBatchingWindow: Duration.seconds(0),
    reportBatchItemFailures: true,
  })
);

const budgetTableArn = app.node.tryGetContext("budgetTableArn");
if (typeof budgetTableArn === "string" && budgetTableArn) {
  const budgetPolicy = new Policy(stack, "WorkerBudgetPolicy", {
    statements: [
      new PolicyStatement({
        sid: "BudgetAccess",
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"],
        resources: [budgetTableArn],
      }),
    ],
  });
  budgetPolicy.attachToRole(workerRole);
}

const botsTableArn = app.node.tryGetContext("botsTableArn");
if (typeof botsTableArn === "string" && botsTableArn) {
  const botsPolicy = new Policy(stack, "WorkerBotsPolicy", {
    statements: [
      new PolicyStatement({
        sid: "BotsAccess",
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
        resources: [botsTableArn, `${botsTableArn}/index/*`],
      }),
    ],
  });
  botsPolicy.attachToRole(workerRole);
}

new CfnOutput(stack, "WorkerQueueUrl", { value: workerQueue.queueUrl });
new CfnOutput(stack, "WorkerQueueArn", { value: workerQueue.queueArn });
new CfnOutput(stack, "WorkerDLQUrl", { value: workerDlq.queueUrl });
new CfnOutput(stack, "WorkerDLQArn", { value: workerDlq.queueArn });
new CfnOutput(stack, "SchedulerDeliveryDLQUrl", { value: schedulerDeliveryDlq.queueUrl });
new CfnOutput(stack, "SchedulerDeliveryDLQArn", { value: schedulerDeliveryDlq.queueArn });
new CfnOutput(stack, "RunsTableName", { value: runsTable.tableName });
new CfnOutput(stack, "RunsTableArn", { value: runsTable.tableArn });
new CfnOutput(stack, "RoutinesTableName", { value: routinesTable.tableName });
new CfnOutput(stack, "RoutinesTableArn", { value: routinesTable.tableArn });
new CfnOutput(stack, "WorkerFunctionArn", { value: workerFunction.functionArn });
new CfnOutput(stack, "WorkerRoleArn", { value: workerRole.roleArn });
new CfnOutput(stack, "SchedulerRoleArn", { value: schedulerRole.roleArn });

app.synth();
