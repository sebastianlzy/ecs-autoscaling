const {Stack, CfnOutput, Fn, Duration} = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const ecr = require('aws-cdk-lib/aws-ecr');
const iam = require('aws-cdk-lib/aws-iam')
const codepipeline = require('aws-cdk-lib/aws-codepipeline')
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions')
const lambda = require('aws-cdk-lib/aws-lambda')

const lambdaFunctionName = "queue-processing-lambda-function"


class LoadGenerationResourceStack extends Stack {


    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const ecrRepositoryName = Fn.importValue("ecrRepositoryName")
        const ecrRepository = ecr.Repository.fromRepositoryName(this, "ecrRepository", ecrRepositoryName )

        const queueArn = Fn.importValue("queueArn")


        // const lambdaFunction = new lambda.DockerImageFunction(this, 'lambdaFunction', {
        //     code: lambda.DockerImageCode.fromEcr(ecrRepository, {
        //         cmd: ["generate-load.main"]
        //     }),
        //     environment: {
        //         QUEUE_ARN: queueArn
        //     },
        //     timeout: Duration.seconds(30)
        // })


    }
}

module.exports = {LoadGenerationResourceStack}
