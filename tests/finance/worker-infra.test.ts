import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { Queue, DeadLetterQueue } from "aws-cdk-lib/aws-sqs";
import { Table, AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { Function as LambdaFunction, Runtime, Code, Architecture } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Role, ServicePrincipal, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Duration, RemovalPolicy } from "aws-cdk-lib";

describe("FinanceWorker CDK Stack", () => {
  test("synthesizes SQS queue with DLQ and correct configuration", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const dlq = new Queue(stack, "WorkerDLQ", {
      queueName: "test-worker-dlq",
      retentionPeriod: Duration.days(14),
    });

    const workerQueue = new Queue(stack, "WorkerQueue", {
      queueName: "test-worker-queue",
      visibilityTimeout: Duration.seconds(1080),
      retentionPeriod: Duration.days(14),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 5,
      } as DeadLetterQueue,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "test-worker-queue",
      VisibilityTimeout: 1080,
      MessageRetentionPeriod: 1209600,
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 5,
      }),
    });

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "test-worker-dlq",
    });
  });

  test("synthesizes separate Scheduler delivery DLQ", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const schedulerDlq = new Queue(stack, "SchedulerDeliveryDLQ", {
      queueName: "test-scheduler-delivery-dlq",
      retentionPeriod: Duration.days(14),
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "test-scheduler-delivery-dlq",
    });
  });

  test("synthesizes Lambda worker with correct timeout and configuration", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const workerRole = new Role(stack, "WorkerRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    const workerFunction = new LambdaFunction(stack, "WorkerFunction", {
      functionName: "test-agent-worker",
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => {}"),
      timeout: Duration.seconds(180),
      memorySize: 512,
      role: workerRole,
      reservedConcurrentExecutions: 5,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "test-agent-worker",
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
      Timeout: 180,
      MemorySize: 512,
      ReservedConcurrentExecutions: 5,
    });
  });

  test("synthesizes Lambda event source with batch size 1 and ReportBatchItemFailures", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const dlq = new Queue(stack, "DLQ");
    const queue = new Queue(stack, "Queue", {
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
    });

    const role = new Role(stack, "Role", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    const fn = new LambdaFunction(stack, "Function", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => {}"),
      role,
    });

    fn.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 1,
        maxBatchingWindow: Duration.seconds(0),
        reportBatchItemFailures: true,
      })
    );

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 1,
      MaximumBatchingWindowInSeconds: 0,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
    });
  });

  test("synthesizes DynamoDB tables with correct schema and GSI", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const runsTable = new Table(stack, "AgentRuns", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: RemovalPolicy.RETAIN,
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

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
      TimeToLiveSpecification: {
        AttributeName: "expiresAt",
        Enabled: true,
      },
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: "ByOwnerStatus",
          KeySchema: [
            { AttributeName: "ownerId", KeyType: "HASH" },
            { AttributeName: "statusCreatedAt", KeyType: "RANGE" },
          ],
        }),
        Match.objectLike({
          IndexName: "ByRoutineScheduled",
          KeySchema: [
            { AttributeName: "routineId", KeyType: "HASH" },
            { AttributeName: "scheduledAt", KeyType: "RANGE" },
          ],
        }),
      ]),
    });
  });

  test("synthesizes Scheduler IAM role with SQS send permission", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const queue = new Queue(stack, "Queue");

    const schedulerRole = new Role(stack, "SchedulerRole", {
      assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    });

    const policy = new Policy(stack, "SchedulerPolicy", {
      statements: [
        new PolicyStatement({
          actions: ["sqs:SendMessage"],
          resources: [queue.queueArn],
        }),
      ],
    });
    policy.attachToRole(schedulerRole);

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: "scheduler.amazonaws.com" },
          }),
        ]),
      }),
    });
  });

  test("synthesizes Worker IAM role with DynamoDB and SQS permissions", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const table = new Table(stack, "Table", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
    });

    const queue = new Queue(stack, "Queue");

    const workerRole = new Role(stack, "WorkerRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    const policy = new Policy(stack, "WorkerPolicy", {
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
          resources: [table.tableArn],
        }),
        new PolicyStatement({
          actions: [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes",
          ],
          resources: [queue.queueArn],
        }),
      ],
    });
    policy.attachToRole(workerRole);

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["dynamodb:GetItem", "dynamodb:TransactWriteItems"]),
          }),
        ]),
      }),
    });
  });

  test("worker CDK synth produces valid CloudFormation", async () => {
    const { execSync } = await import("node:child_process");

    const result = execSync(
      "npx cdk synth --app 'node_modules/.bin/tsx infra/finance-worker.ts' --output /tmp/zakkdev-finance-worker-cdk.out 2>&1",
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: { ...process.env, AWS_REGION: "ap-northeast-2" },
      }
    );

    assert.ok(!result.includes("Error"), `CDK synth failed: ${result}`);
  });
});
