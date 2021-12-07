const {Stack, CfnOutput} = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const ecr = require('aws-cdk-lib/aws-ecr');



class CodePipelineResourceStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const ecrRepositoryName = "queue-processing-ecr-repo"
        const codebuildName = "queue-processing-codebuild-project"
        const codeCommitRepositoryName = "queue-processing-codecommit-repo"
        const imageTagVersion = "v1.0.0"

        const repository = new ecr.Repository(this, 'Repository', {
            repositoryName: ecrRepositoryName
        });
        const codeCommitRepository = new codecommit.Repository(this, 'QueueProcessingRepo', {
            repositoryName: codeCommitRepositoryName
        });

        new codebuild.Project(this, 'QueueProcessingProject', {
            source: codebuild.Source.codeCommit({ repository: codeCommitRepository }),
            projectName: codebuildName,
            environmentVariables: {
                AWS_DEFAULT_REGION: {value: process.env.CDK_DEFAULT_REGION},
                AWS_ACCOUNT_ID: {value: process.env.CDK_DEFAULT_ACCOUNT},
                IMAGE_REPO_NAME: {value: ecrRepositoryName},
                IMAGE_TAG: {value: imageTagVersion}
            }
        });

        new CfnOutput(this, 'codeCommitRepository', {
            value: codeCommitRepository.repositoryCloneUrlGrc
        })
    }
}

module.exports = {CodePipelineResourceStack}
