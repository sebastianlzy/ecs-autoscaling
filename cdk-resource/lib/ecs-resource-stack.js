const {Stack, Duration} = require('aws-cdk-lib');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const ecs = require('aws-cdk-lib/aws-ecs');
const ec2 = require('aws-cdk-lib/aws-ec2');
const sqs = require('aws-cdk-lib/aws-sqs');


class ECSResourceStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
            isDefault: true,
        });
        const {ecrRepository} = props


        const queue =  new sqs.Queue(this, 'Queue')
        const cluster = new ecs.Cluster(this, 'ECSFargateCluster', {vpc});

        const queueProcessingFargateService = new ecsPatterns.QueueProcessingFargateService(this, 'QueueProcessingFargateService', {
            cluster,
            memoryLimitMiB: 1024,
            cpu: 512,
            taskImageOptions: {
                image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                containerPort: 3000,
                enableLogging: true
            },
            environment: {
                QUEUE_NAME: queue.queueName,
                QUEUE_URL: queue.queueUrl,
                QUEUE_ARN: queue.queueArn
            },
            queue: queue,
            assignPublicIp: true,
            enableECSManagedTags: true,
            minScalingCapacity: 0
        });



        const scalableTaskCount = queueProcessingFargateService.service.autoScaleTaskCount({
            maxCapacity: 4
        })
        scalableTaskCount.scaleOnCpuUtilization('CpuUtilizationScaling', {
            targetUtilizationPercent: 50
        })
    }
}

module.exports = {ECSResourceStack}
