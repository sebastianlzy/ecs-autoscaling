const {Stack, CfnOutput} = require('aws-cdk-lib');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const ecs = require('aws-cdk-lib/aws-ecs');
const ec2 = require('aws-cdk-lib/aws-ec2');
const sqs = require('aws-cdk-lib/aws-sqs');
const ecr = require('aws-cdk-lib/aws-ecr')
const iam = require('aws-cdk-lib/aws-iam')

const ecsFargateQueueProcessingServiceName = "queue-processing-ecs-service"
const ecsFargateLoadGenerationServiceName = "load-generation-ecs-service"
const ecrRepositoryName = "queue-processing-ecr-repo"
const ecsClusterName = "ecs-autoscaling-cluster"
const queueName = "queue-processing-queue"

class ECSResourceStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const lookupVPC = () => ec2.Vpc.fromLookup(this, 'Vpc', {
            isDefault: true,
        });
        const createQueue =  () => {
            const queue =  new sqs.Queue(this, 'Queue', {
                queueName: queueName
            })

            new CfnOutput(this, 'queueArn', {
                value: queue.queueArn,
                exportName: 'queueArn'
            })
            new CfnOutput(this, 'queueUrl', {
                value: queue.queueUrl,
                exportName: 'queueUrl'
            })
            new CfnOutput(this, 'queueName', {
                value: queue.queueName,
                exportName: 'queueName'
            })
            return queue
        }
        const createECSCluster = (vpc) => {
            const cluster = new ecs.Cluster(this, 'ECSFargateCluster', {
                vpc,
                clusterName: ecsClusterName
            });

            new CfnOutput(this, 'clusterArn', {
                value: cluster.clusterArn,
                exportName: 'clusterArn'
            })

            return cluster
        }
        const createECRRepository = () => {
            const ecrRepository = new ecr.Repository(this, 'Repository', {
                repositoryName: ecrRepositoryName
            });
            new CfnOutput(this, 'ecrRepositoryName', {
                value: ecrRepository.repositoryName,
                exportName: 'ecrRepositoryName'
            })

            return ecrRepository
        }
        const createQueueProcessingFargateService = (ecrRepository, cluster, queue) => {
            const queueProcessingFargateService = new ecsPatterns.QueueProcessingFargateService(this, 'QueueProcessingFargateService', {
                cluster,
                memoryLimitMiB: 1024,
                cpu: 512,
                image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                environment: {
                    QUEUE_NAME: queue.queueName,
                    QUEUE_URL: queue.queueUrl,
                    QUEUE_ARN: queue.queueArn
                },
                queue: queue,
                assignPublicIp: true,
                enableECSManagedTags: true,
                minScalingCapacity: 1,
                maxScalingCapacity: 20,
                command: [ "node", "process-message.js" ],
                serviceName: ecsFargateQueueProcessingServiceName
            });

            new CfnOutput(this, 'queueProcessingFargateServiceArn', {
                value: queueProcessingFargateService.service.serviceArn,
                exportName: 'queueProcessingFargateServiceArn'
            })

            return queueProcessingFargateService
        }
        const createLoadBalancedFargateService = (ecrRepository, cluster, queue) => {
            const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
                cluster,
                memoryLimitMiB: 1024,
                desiredCount: 1,
                cpu: 512,
                taskImageOptions: {
                    image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                    containerPort: 3000,
                    environment: {
                        QUEUE_NAME: queue.queueName,
                        QUEUE_URL: queue.queueUrl,
                        QUEUE_ARN: queue.queueArn
                    }
                },
                serviceName: ecsFargateLoadGenerationServiceName,
                assignPublicIp: true,
                enableECSManagedTags: true,
            });

            queue.grantSendMessages(loadBalancedFargateService.taskDefinition.taskRole)
            return loadBalancedFargateService
        }

        const vpc = lookupVPC()
        const queue = createQueue()
        const cluster = createECSCluster(vpc)
        const ecrRepository = createECRRepository()

        createQueueProcessingFargateService(ecrRepository, cluster, queue)
        createLoadBalancedFargateService(ecrRepository, cluster, queue)

    }
}

module.exports = {ECSResourceStack}
