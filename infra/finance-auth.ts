import { App, CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Policy, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

const app = new App();
const stack = new Stack(app, "FinanceAuth", { env: { region: process.env.AWS_REGION || "ap-northeast-2" } });
const table = new Table(stack, "LoginAttempts", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});
const roleName = app.node.tryGetContext("runtimeRoleName");
if (typeof roleName === "string" && roleName) {
  const policy = new Policy(stack, "RuntimePolicy", {
    statements: [new PolicyStatement({ actions: ["dynamodb:UpdateItem"], resources: [table.tableArn] })],
  });
  policy.attachToRole(Role.fromRoleName(stack, "VercelRole", roleName));
}
new CfnOutput(stack, "AuthTableName", { value: table.tableName });
new CfnOutput(stack, "AuthTableArn", { value: table.tableArn });
app.synth();
