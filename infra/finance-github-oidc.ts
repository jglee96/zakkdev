import { App, CfnOutput, Stack } from "aws-cdk-lib";
import {
  OpenIdConnectProvider,
  PolicyDocument,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from "aws-cdk-lib/aws-iam";

const app = new App();
const stack = new Stack(app, "FinanceGithubOidc", {
  env: { region: process.env.AWS_REGION || "ap-northeast-2" },
});

const githubRepository =
  (app.node.tryGetContext("githubRepository") as string | undefined) || "jglee96/zakkdev";
const deployRoleName =
  (app.node.tryGetContext("githubDeployRoleName") as string | undefined) || "finance-github-deploy";
const diffRoleName =
  (app.node.tryGetContext("githubDiffRoleName") as string | undefined) || "finance-github-diff";

const issuerHost = "token.actions.githubusercontent.com";
const issuerUrl = `https://${issuerHost}`;

const existingProviderArn = app.node.tryGetContext("existingGithubOidcProviderArn") as
  | string
  | undefined;

const provider = existingProviderArn
  ? OpenIdConnectProvider.fromOpenIdConnectProviderArn(stack, "GithubOidc", existingProviderArn)
  : new OpenIdConnectProvider(stack, "GithubOidc", {
      url: issuerUrl,
      clientIds: ["sts.amazonaws.com"],
    });

const deployPolicy = new PolicyDocument({
  statements: [
    new PolicyStatement({
      sid: "CdkDeployFinanceStacks",
      actions: [
        "cloudformation:*",
        "iam:*",
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "sqs:*",
        "scheduler:*",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "logs:*",
        "events:*",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ecr:*",
        "sts:AssumeRole",
      ],
      resources: ["*"],
    }),
  ],
});

const readPolicy = new PolicyDocument({
  statements: [
    new PolicyStatement({
      sid: "CdkDiffFinanceStacks",
      actions: [
        "cloudformation:DescribeStacks",
        "cloudformation:GetTemplate",
        "cloudformation:ListStacks",
        "iam:GetRole",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "s3:GetObject",
        "s3:ListBucket",
        "dynamodb:DescribeTable",
        "lambda:GetFunction",
        "sqs:GetQueueAttributes",
        "scheduler:GetSchedule",
        "scheduler:ListSchedules",
        "ssm:GetParameter",
      ],
      resources: ["*"],
    }),
  ],
});

const deployRole = new Role(stack, "GithubDeployRole", {
  roleName: deployRoleName,
  description: "GitHub Actions deploy for finance CDK (main branch)",
  assumedBy: new WebIdentityPrincipal(provider.openIdConnectProviderArn, {
    StringEquals: {
      [`${issuerHost}:aud`]: "sts.amazonaws.com",
    },
    StringLike: {
      [`${issuerHost}:sub`]: `repo:${githubRepository}:ref:refs/heads/main`,
    },
  }),
  inlinePolicies: {
    FinanceCdkDeploy: deployPolicy,
  },
});

const diffRole = new Role(stack, "GithubDiffRole", {
  roleName: diffRoleName,
  description: "GitHub Actions cdk diff for finance CDK (pull requests)",
  assumedBy: new WebIdentityPrincipal(provider.openIdConnectProviderArn, {
    StringEquals: {
      [`${issuerHost}:aud`]: "sts.amazonaws.com",
    },
    StringLike: {
      [`${issuerHost}:sub`]: `repo:${githubRepository}:pull_request`,
    },
  }),
  inlinePolicies: {
    FinanceCdkDiff: readPolicy,
  },
});

new CfnOutput(stack, "GithubOidcProviderArn", { value: provider.openIdConnectProviderArn });
new CfnOutput(stack, "GithubDeployRoleArn", { value: deployRole.roleArn });
new CfnOutput(stack, "GithubDeployRoleName", { value: deployRole.roleName });
new CfnOutput(stack, "GithubDiffRoleArn", { value: diffRole.roleArn });
new CfnOutput(stack, "GithubDiffRoleName", { value: diffRole.roleName });

app.synth();
