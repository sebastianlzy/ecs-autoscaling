const {Stack, Duration, Fn, CfnOutput} = require('aws-cdk-lib');
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
            const queue =  new sqs.Queue(this, 'Queue')
            new CfnOutput(this, 'queueArn', {
                value: queue.queueArn,
                exportName: 'queueArn'
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
            return new ecsPatterns.QueueProcessingFargateService(this, 'QueueProcessingFargateService', {
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
                command: [ "node", "process-message.js" ],
                serviceName: ecsFargateQueueProcessingServiceName
            });
        }
        const addTrackingPolicyToECSService = (service) => {
            // const scalableTaskCount = queueProcessingFargateService.service.autoScaleTaskCount({
            //     maxCapacity: 4
            // })
            // scalableTaskCount.scaleOnCpuUtilization('CpuUtilizationScaling', {
            //     targetUtilizationPercent: 50
            // })
        }


        const fetchIAMAdminPolicy = () => iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
        const createLoadBalancedFargateService = (ecrRepository, cluster, queue, IAMAdminPolicy) => {
            return new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
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
        }
        const addIAMAdminPolicyToTaskExecutionRole = (ecsService, iamPolicy) => {
            const taskRole = ecsService.taskDefinition.taskRole
            taskRole.addManagedPolicy(iamPolicy)
        }

        const vpc = lookupVPC()
        const queue = createQueue()
        const cluster = createECSCluster(vpc)
        const ecrRepository = createECRRepository()

        const queueProcessingFargateService = createQueueProcessingFargateService(ecrRepository, cluster, queue)
        addTrackingPolicyToECSService(queueProcessingFargateService)

        const loadBalancedFargateService = createLoadBalancedFargateService(ecrRepository, cluster, queue)
        const IAMAdminPolicy = fetchIAMAdminPolicy()
        addIAMAdminPolicyToTaskExecutionRole(loadBalancedFargateService, IAMAdminPolicy)



    }
}

module.exports = {ECSResourceStack}
