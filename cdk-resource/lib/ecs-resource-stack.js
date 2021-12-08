const {Stack, Duration} = require('aws-cdk-lib');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const ecs = require('aws-cdk-lib/aws-ecs');
const ec2 = require('aws-cdk-lib/aws-ec2');


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

        const cluster = new ecs.Cluster(this, 'ECSFargateCluster', {vpc});
        //
        // const queueProcessingFargateService = new ecsPatterns.QueueProcessingFargateService(this, 'QueueProcessingFargateService', {
        //   cluster,
        //   memoryLimitMiB: 512,
        //   image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
        //   command: ["-queue", "4", "amazon.com"],
        //   enableLogging: false,
        //   desiredTaskCount: 1,
        //   environment: {
        //     TEST_ENVIRONMENT_VARIABLE1: "test environment variable 1 value",
        //     TEST_ENVIRONMENT_VARIABLE2: "test environment variable 2 value",
        //   },
        //   maxScalingCapacity: 5,
        //   containerName: 'test',
        // })

        const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'MyWebServer', {
            cluster,
            memoryLimitMiB: 1024,
            cpu: 512,
            taskImageOptions: {
                image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                containerPort: 3000,
                enableLogging: true
                // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
            },
            publicLoadBalancer: true,
            assignPublicIp: true,

        });

        loadBalancedFargateService.targetGroup.configureHealthCheck({
            path: "/",
            port: "3000"
        });
    }
}

module.exports = {ECSResourceStack}
