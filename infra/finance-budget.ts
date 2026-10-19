import { App, CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Policy, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

const app = new App();
const stack = new Stack(app, "FinanceBudget", { env: { region: process.env.AWS_REGION || "ap-northeast-2" } });
const table = new Table(stack, "BudgetTracking", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});
const roleName = app.node.tryGetContext("runtimeRoleName");
if (typeof roleName === "string" && roleName) {
  const policy = new Policy(stack, "RuntimePolicy", {
    statements: [
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"],
        resources: [table.tableArn],
      }),
    ],
  });
  policy.attachToRole(Role.fromRoleName(stack, "VercelRole", roleName));
}
new CfnOutput(stack, "BudgetTableName", { value: table.tableName });
new CfnOutput(stack, "BudgetTableArn", { value: table.tableArn });
app.synth();
