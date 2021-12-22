const {Stack, CfnOutput, Fn} = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const iam = require('aws-cdk-lib/aws-iam')
const codepipeline = require('aws-cdk-lib/aws-codepipeline')
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions')

const ecrRepositoryName = "queue-processing-ecr-repo"
const codebuildName = "queue-processing-codebuild-project"
const codepipelineName = "queue-processing-codepipeline"
const codeCommitRepositoryName = "queue-processing-codecommit-repo"
const ecsFargateQueueProcessingServiceName = "queue-processing-ecs-service"
const ecsFargateLoadGenerationServiceName = "load-generation-ecs-service"
const imageTagVersion = "latest"
const ecsClusterName = "ecs-autoscaling-cluster"


class CodePipelineResourceStack extends Stack {

    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const createCodePipeline = (codeCommitRepository, codebuildProject, codeDeployProject) => {
            const sourceOutput = new codepipeline.Artifact('sourceArtifact');
            const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
                actionName: 'CodeCommit',
                repository: codeCommitRepository,
                output: sourceOutput,
                branch: "main"
            });



            const buildOutput = new codepipeline.Artifact('buildArtifact');
            const buildAction = new codepipeline_actions.CodeBuildAction({
                actionName: 'CodeBuild',
                project: codebuildProject,
                input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
                outputs: [buildOutput]
            });

            return new codepipeline.Pipeline(this, 'QueueProcessingPipeline', {
                pipelineName: codepipelineName,
                stages: [
                    {
                        stageName: 'Source',
                        actions: [sourceAction],
                    },
                    {
                        stageName: 'Build',
                        actions: [buildAction]
                    }
                ]
            });


        }
        const createCodebuild = () => {
            const adminManagedPolicyArn = "arn:aws:iam::aws:policy/AdministratorAccess"
            const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
                assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
                managedPolicies: [{
                    managedPolicyArn: adminManagedPolicyArn
                }],
                roleName: "CodeBuildRole"
            })

            return new codebuild.PipelineProject(this, 'QueueProcessingProject', {
                projectName: codebuildName,
                environmentVariables: {
                    AWS_DEFAULT_REGION: {value: process.env.CDK_DEFAULT_REGION},
                    AWS_ACCOUNT_ID: {value: process.env.CDK_DEFAULT_ACCOUNT},
                    IMAGE_REPO_NAME: {value: ecrRepositoryName},
                    IMAGE_TAG: {value: imageTagVersion},
                    ECS_CLUSTER_NAME: {value: ecsClusterName},
                    ECS_QUEUE_PROCESSING_SERVICE_NAME: {value: ecsFargateQueueProcessingServiceName},
                    ECS_LOAD_GENERATION_SERVICE_NAME: {value: ecsFargateLoadGenerationServiceName}
                },
                environment: {
                    buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
                    privileged: true,
                    computeType: codebuild.ComputeType.SMALL
                },
                role: codeBuildRole
            });

        }
        const createCodeRepository = () => {
            const codeCommitRepository = new codecommit.Repository(this, 'QueueProcessingRepo', {
                repositoryName: codeCommitRepositoryName
            });
            new CfnOutput(this, 'codeCommitRepositoryUrlGrc', {
                value: codeCommitRepository.repositoryCloneUrlGrc,
                exportName: 'codeCommitRepositoryUrlGrc'
            })
            return codeCommitRepository
        }

        const codeCommitRepository = createCodeRepository()
        const codebuildProject = createCodebuild()
        createCodePipeline(codeCommitRepository, codebuildProject)



    }
}

module.exports = {CodePipelineResourceStack}
