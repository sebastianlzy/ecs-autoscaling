#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ECSResourceStack } = require('../lib/ecs-resource-stack');
const { CodePipelineResourceStack } = require('../lib/codepipeline-resource-stack');


const app = new cdk.App();

new CodePipelineResourceStack(app, 'CodePipelineResourceStack', {});
new ECSResourceStack(app, 'ECSResourceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
