import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { OpenIdConnectProvider, Role, WebIdentityPrincipal } from "aws-cdk-lib/aws-iam";

const app = new App();
const stack = new Stack(app, "FinanceVercelOidc", {
  env: { region: process.env.AWS_REGION || "ap-northeast-2" },
});

const teamSlug = app.node.tryGetContext("vercelTeamSlug") as string | undefined;
if (!teamSlug) {
  throw new Error("CDK context vercelTeamSlug is required (Vercel team URL slug)");
}

const projectName = (app.node.tryGetContext("vercelProjectName") as string | undefined) || "zakkdev";
const environmentsRaw = (app.node.tryGetContext("vercelEnvironments") as string | undefined) || "production";
const environments = environmentsRaw.split(",").map((value) => value.trim()).filter(Boolean);
const roleName =
  (app.node.tryGetContext("vercelRuntimeRoleName") as string | undefined) || "finance-vercel-runtime";

const issuerHost = `oidc.vercel.com/${teamSlug}`;
const providerUrl = `https://${issuerHost}`;
const audience = `https://vercel.com/${teamSlug}`;

const existingProviderArn = app.node.tryGetContext("existingVercelOidcProviderArn") as string | undefined;

const provider = existingProviderArn
  ? OpenIdConnectProvider.fromOpenIdConnectProviderArn(stack, "VercelOidc", existingProviderArn)
  : new OpenIdConnectProvider(stack, "VercelOidc", {
      url: providerUrl,
      clientIds: [audience],
    });

const subjectPatterns = environments.map(
  (environment) => `owner:${teamSlug}:project:${projectName}:environment:${environment}`,
);

const vercelRuntimeRole = new Role(stack, "VercelRuntimeRole", {
  roleName,
  description: "Vercel server runtime for finance Next.js (OIDC)",
  assumedBy: new WebIdentityPrincipal(provider.openIdConnectProviderArn, {
    StringEquals: {
      [`${issuerHost}:aud`]: audience,
    },
    StringLike: {
      [`${issuerHost}:sub`]: subjectPatterns,
    },
  }),
});

new CfnOutput(stack, "VercelOidcProviderArn", { value: provider.openIdConnectProviderArn });
new CfnOutput(stack, "VercelRuntimeRoleArn", { value: vercelRuntimeRole.roleArn });
new CfnOutput(stack, "VercelRuntimeRoleName", { value: vercelRuntimeRole.roleName });
new CfnOutput(stack, "VercelOidcAudience", { value: audience });
new CfnOutput(stack, "VercelOidcIssuerUrl", { value: providerUrl });

app.synth();
