const {Stack, Fn} = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const events = require("aws-cdk-lib/aws-events");
const sqs = require("aws-cdk-lib/aws-sqs");
const eventTargets = require("aws-cdk-lib/aws-events-targets");
const global = require("./global.json")
const iam = require("aws-cdk-lib/aws-iam");

const {
    ecsFargateQueueProcessingServiceName,
    ecsClusterName,
    acceptableLatencyInSeconds,
    averageProcessingTimePerJobInSeconds,
    metricUnit,
    metricNamespace,
    metricName
} = global


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
            const fnRole = fn.role
            const policy = new iam.Policy(this, "IAMPolicyForECSCluster", {
                policyName: "IAMPolicyForECSCluster",
                statements: [
                    new iam.PolicyStatement({
                        actions: [ 'ecs:ListTasks', "ecs:UpdateService", "cloudwatch:PutMetricData" ],
                        effect: iam.Effect.ALLOW,
                        resources: ["*"]
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
                    ECS_SERVICE_NAME: ecsFargateQueueProcessingServiceName,
                    ECS_CLUSTER_NAME: ecsClusterName,
                    ACCEPTABLE_LATENCY: acceptableLatencyInSeconds,
                    AVERAGE_PROCESSING_TIME: averageProcessingTimePerJobInSeconds,
                    METRIC_NAMESPACE: metricNamespace,
                    METRIC_NAME: metricName,
                    METRIC_UNIT: metricUnit
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

            const loadBalancerDnsName = Fn.importValue("loadBalancerDnsName")
            return new lambda.Function(this, "SendMessageHandler", {
                runtime: lambda.Runtime.NODEJS_14_X, // So we can use async in widget.js
                code: lambda.Code.fromAsset("resources"),
                handler: "send-message.main",
                environment: {
                    BASE_URL: loadBalancerDnsName,
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