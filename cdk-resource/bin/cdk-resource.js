#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ECSResourceStack } = require('../lib/ecs-resource-stack');
const { CodePipelineResourceStack } = require('../lib/codepipeline-resource-stack');
const { LoadGenerationResourceStack } = require('../lib/loadgeneration-resource-stack');


const app = new cdk.App();


const ecsResourceStack = new ECSResourceStack(app, 'ECSResourceStack', {
  stackName: 'ECSResourceStack',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
})

const codePipelineResourceStack = new CodePipelineResourceStack(app, 'CodePipelineResourceStack', {
  stackName: 'CodePipelineResourceStack',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const loadGenerationStack = new LoadGenerationResourceStack(app, 'LoadGenerationResourceStack', {
  stackName: 'LoadGenerationResourceStack',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
})

// ecsResourceStack.addDependency(codePipelineResourceStack)
// loadGenerationStack.addDependency(codePipelineResourceStack)