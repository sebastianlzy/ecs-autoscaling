const {Stack, Fn} = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const events = require("aws-cdk-lib/aws-events");
const sqs = require("aws-cdk-lib/aws-sqs");
const ecs = require("aws-cdk-lib/aws-ecs");
const eventTargets = require("aws-cdk-lib/aws-events-targets");
const global = require("./global.json")
const ec2 = require("aws-cdk-lib/aws-ec2");
const iam = require("aws-cdk-lib/aws-iam");

const ecsServiceName = global.ecsFargateQueueProcessingServiceName
const ecsClusterName = global.ecsClusterName



class LambdaResourceStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const getQueue = () => {

            const queueArn = Fn.importValue("queueArn")
            return sqs.Queue.fromQueueArn(this, 'QueueProcessingQueue', queueArn)
        }
        const grantLambdaPermissionToListMessages = (fn, queue) => {
            queue.grantSendMessages(fn)
        }
        const grantLambdaPermissionToUpdateECSService = (fn) => {
            const clusterArn = Fn.importValue("clusterArn")
            const fnRole = fn.role
            const policy = new iam.Policy(this, "IAMPolicyForECSCluster", {
                policyName: "IAMPolicyForECSCluster",
                statements: [
                    new iam.PolicyStatement({
                        actions: [ 'ecs:ListTasks', "ecs:UpdateService" ],
                        effect: iam.Effect.ALLOW,
                        // resources: [ clusterArn]
                        resources: [ "*"]
                    })
                ]
            })
            policy.attachToRole(fnRole)
        }
        const createLambdaMetricFunction = () => {
            const queueUrl = Fn.importValue("queueUrl")
            return new lambda.Function(this, "LambdaMetricsHandler", {
                runtime: lambda.Runtime.NODEJS_14_X, // So we can use async in widget.js
                code: lambda.Code.fromAsset("resources"),
                handler: "lambda-metrics.main",
                environment: {
                    QUEUE_URL: queueUrl,
                    ECS_SERVICE_NAME: ecsServiceName,
                    ECS_CLUSTER_NAME: ecsClusterName,
                    ACCEPTABLE_LATENCY: "10",
                    AVERAGE_PROCESSING_TIME: "0.5"
                },
            });
        }
        const createEventBridgeSchedule = (fn, id, cronSchedule={ minute: '0/5' }) => {
            const rule = new events.Rule(this, id, {
                schedule: events.Schedule.cron(cronSchedule),
            });
            rule.addTarget(new eventTargets.LambdaFunction(fn));
        }

        const createSendMessageLambdaFunction = () => {
            return new lambda.Function(this, "SendMessageHandler", {
                runtime: lambda.Runtime.NODEJS_14_X, // So we can use async in widget.js
                code: lambda.Code.fromAsset("resources"),
                handler: "send-message.main",
                environment: {
                    BASE_URL: "http://ecsre-servi-12jtih2jvyavj-1913528293.ap-southeast-1.elb.amazonaws.com/",
                },
            });
        }

        const lambdaMetricFn = createLambdaMetricFunction()
        grantLambdaPermissionToListMessages(lambdaMetricFn, getQueue())
        grantLambdaPermissionToUpdateECSService(lambdaMetricFn)
        createEventBridgeSchedule(lambdaMetricFn, 'EventBridgeScheduleForLambdaMetric', { minute: '0/5' })

        const sendMessageFn = createSendMessageLambdaFunction()
        createEventBridgeSchedule(sendMessageFn, 'EventBridgeScheduleForSendMessage', { minute: '0/1' })

    }
}

module.exports = { LambdaResourceStack }