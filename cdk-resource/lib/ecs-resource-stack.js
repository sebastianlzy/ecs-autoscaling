const {Stack, CfnOutput, Duration, Fn} = require('aws-cdk-lib');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const ecs = require('aws-cdk-lib/aws-ecs');
const ec2 = require('aws-cdk-lib/aws-ec2');
const sqs = require('aws-cdk-lib/aws-sqs');
const ecr = require('aws-cdk-lib/aws-ecr')
const cloudwatch = require('aws-cdk-lib/aws-cloudwatch')
const global = require("./global.json");


const {
    ecsFargateQueueProcessingServiceName,
    ecsClusterName,
    ecsFargateLoadGenerationServiceName,
    ecrRepositoryName,
    ecsTargetTrackingPolicyName,
    queueName,
    metricUnit,
    acceptableLatencyInSeconds,
    averageProcessingTimePerJobInSeconds,
    metricName,
    metricNamespace
} = global

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
        const createQueue = () => {
            const queue = new sqs.Queue(this, 'Queue', {
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
        const getECRRepository = () => {
            // const ecrRepository = new ecr.Repository(this, 'Repository', {
            //     repositoryName: ecrRepositoryName
            // });
            // new CfnOutput(this, 'ecrRepositoryName', {
            //     value: ecrRepository.repositoryName,
            //     exportName: 'ecrRepositoryName'
            // })
            const ecrRepositoryName = Fn.importValue("ecrRepositoryName")
            const ecrRepository = ecr.Repository.fromRepositoryName(this, 'ecrRepositoryName', ecrRepositoryName)

            return ecrRepository
        }
        const createQueueProcessingFargateService = (ecrRepository, cluster, queue) => {

            const taskDefinition = new ecs.FargateTaskDefinition(this, 'QueueProcessingTaskDefinition')
            taskDefinition.addContainer('queueProcessingContainer', {
                image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                // memoryLimitMiB: 512,
                // cpu: 512,
                logging: new ecs.AwsLogDriver({ streamPrefix: 'QueueProcessingTask', mode: ecs.AwsLogDriverMode.NON_BLOCKING }),
                command: ["node", "process-message.js"],
                environment: {
                    QUEUE_NAME: queue.queueName,
                    QUEUE_URL: queue.queueUrl,
                    QUEUE_ARN: queue.queueArn
                }
            })

            const queueProcessingFargateService = new ecs.FargateService(this, 'QueueProcessingFargateService', {
                cluster,
                taskDefinition,
                serviceName: ecsFargateQueueProcessingServiceName,
                capacityProviderStrategies: [
                    {
                        capacityProvider: 'FARGATE_SPOT',
                        weight: 2,
                    },
                    {
                        capacityProvider: 'FARGATE',
                        weight: 1,
                    },
                ],
                assignPublicIp: true,
                enableECSManagedTags: true,
            })

            queue.grantConsumeMessages(queueProcessingFargateService.taskDefinition.taskRole)

            new CfnOutput(this, 'queueProcessingFargateServiceArn', {
                value: queueProcessingFargateService.serviceArn,
                exportName: 'queueProcessingFargateServiceArn'
            })

            return queueProcessingFargateService
        }
        const createLoadBalancedFargateService = (ecrRepository, cluster, queue) => {
            const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'LoadBalancedFargateService', {
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

            new CfnOutput(this, 'loadBalancerDnsName', {
                value: loadBalancedFargateService.loadBalancer.loadBalancerDnsName,
                exportName: 'loadBalancerDnsName'
            })

            return loadBalancedFargateService
        }

        const updateScalingPolicy = (queueProcessingFargateService, targetTrackingMetrics) => {

            const scalableTarget = queueProcessingFargateService.autoScaleTaskCount({
                minCapacity: 1,
                maxCapacity: 40
            })

            const backlogPerTaskCloudwatchMetric = new cloudwatch.Metric({
                metricName: metricName,
                namespace: metricNamespace,
                statistic: "AVERAGE",
                unit: metricUnit,
                dimensionsMap:{
                    ECSClusterName: ecsClusterName,
                    ECSServiceName: ecsFargateQueueProcessingServiceName
                }
            })
            scalableTarget.scaleToTrackCustomMetric("scaleToTrackBacklogPerTask", {
                metric: backlogPerTaskCloudwatchMetric,
                policyName: ecsTargetTrackingPolicyName,
                scaleInCooldown: Duration.minutes(5),
                scaleOutCooldown: Duration.minutes(5),
                targetValue: targetTrackingMetrics
            })
        }

        const getAcceptableBacklogPerTaskMetrics = () => {
            return acceptableLatencyInSeconds/averageProcessingTimePerJobInSeconds
        }

        const vpc = lookupVPC()
        const queue = createQueue()
        const cluster = createECSCluster(vpc)
        const ecrRepository = getECRRepository()

        const queueProcessingFargateService = createQueueProcessingFargateService(ecrRepository, cluster, queue)
        updateScalingPolicy(queueProcessingFargateService, getAcceptableBacklogPerTaskMetrics())

        createLoadBalancedFargateService(ecrRepository, cluster, queue)
    }
}

module.exports = {ECSResourceStack}
