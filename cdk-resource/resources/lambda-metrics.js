const AWS = require('aws-sdk');
const SQS = new AWS.SQS();
const ECS = new AWS.ECS()
const CW = new AWS.CloudWatch()

const getQueueAttributes = (queueUrl, cb) => {
    return new Promise((resolve, reject) => {
        SQS.getQueueAttributes({
            QueueUrl: queueUrl,
            AttributeNames: ["All"]
        },(err, data) => {
            if (err) {
                reject(err)
            }
            resolve(cb(data))
        })
    })
}

const getNumberOfActiveTaskInService = (clusterName, serviceName, cb) => {
    return new Promise((resolve, reject) => {
        ECS.listTasks({
            cluster: clusterName,
            desiredStatus: "RUNNING",
            serviceName: serviceName
        }, (err, data) => {
            if (err) {
                reject(err)
            }

            resolve(cb(data))
        })
    })
}

const scaleNoOfTasksInService = (clusterName, serviceName, noOfTaskDesired) => {
    return new Promise((resolve, reject) => {
        ECS.updateService({
            cluster: clusterName,
            service: serviceName,
            desiredCount: noOfTaskDesired
        }, (err, data) => {
            if (err) {
                reject(err)
            }
            resolve(data)
        })
    })
}

const putMetricData = (backlogPerTask, clusterName, serviceName) => {


    const metricName = process.env.METRIC_NAME
    const metricUnit = process.env.METRIC_UNIT
    const metricNamespace = process.env.METRIC_NAMESPACE

    const params = {
        Namespace: metricNamespace,
        MetricData: [{
            MetricName: metricName,
            Unit: metricUnit,
            Value: backlogPerTask,
            Dimensions : [
                {
                    Name: "ECSClusterName",
                    Value: clusterName
                },
                {
                    Name: "ECSServiceName",
                    Value: serviceName
                },
            ]
        }]
    }

    return new Promise((resolve, reject) => {
        CW.putMetricData(params, (err, data) => {
            if (err) {
                reject(err)
            }
            resolve(data)
        })
    })

}

const scaleECSTask = async (approximateNumberOfMessages) => {
    const averageProcessingTime = process.env.AVERAGE_PROCESSING_TIME
    const acceptableLatency = process.env.ACCEPTABLE_LATENCY
    const acceptableBacklogPerTask = acceptableLatency/averageProcessingTime
    const noOfTaskDesired = approximateNumberOfMessages/acceptableBacklogPerTask

    return await scaleNoOfTasksInService(
        process.env.ECS_CLUSTER_NAME,
        process.env.ECS_SERVICE_NAME,
        noOfTaskDesired
    )
}

exports.main = async function(event, context) {
    try {

        const clusterName = process.env.ECS_CLUSTER_NAME
        const serviceName = process.env.ECS_SERVICE_NAME

        const approximateNumberOfMessages = await getQueueAttributes(
            process.env.QUEUE_URL,
            ({Attributes}) => Attributes["ApproximateNumberOfMessages"]
        )
        const numberOfActiveTaskInService = await getNumberOfActiveTaskInService(
            process.env.ECS_CLUSTER_NAME,
            process.env.ECS_SERVICE_NAME,
            ({taskArns}) => taskArns.length
        )

        const backlogPerTask = approximateNumberOfMessages/numberOfActiveTaskInService
        const metricData = await putMetricData(backlogPerTask, clusterName, serviceName)

        //Instead of using target auto scaling with custom metrics, we can opt-ed to scale ECS task manually
        //await scaleECSTask(approximateNumberOfMessages)

        console.log({
            numberOfActiveTaskInService,
            approximateNumberOfMessages,
            backlogPerTask
        })

        return {
            statusCode: 200,
            body: metricData
        };
    } catch(error) {
        const body = error.stack || JSON.stringify(error, null, 2);
        return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify(body)
        }
    }
}
