const AWS = require('aws-sdk');
const SQS = new AWS.SQS();
const ECS = new AWS.ECS()


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

exports.main = async function(event, context) {
    try {

        const approximateNumberOfMessages = await getQueueAttributes(
            process.env.QUEUE_URL,
            ({Attributes}) => Attributes["ApproximateNumberOfMessages"]
        )
        const numberOfActiveTaskInService = await getNumberOfActiveTaskInService(
            process.env.ECS_CLUSTER_NAME,
            process.env.ECS_SERVICE_NAME,
            ({taskArns}) => taskArns.length
        )
        const averageProcessingTime = process.env.AVERAGE_PROCESSING_TIME
        const acceptableLatency = process.env.ACCEPTABLE_LATENCY
        const acceptableBacklogPerTask = acceptableLatency/averageProcessingTime //20 backlog per task
        const noOfTaskDesired = approximateNumberOfMessages/acceptableBacklogPerTask



        const scaleTasksInService = await scaleNoOfTasksInService(
            process.env.ECS_CLUSTER_NAME,
            process.env.ECS_SERVICE_NAME,
            noOfTaskDesired
        )
        console.log({
            numberOfActiveTaskInService,
            acceptableBacklogPerTask,
            noOfTaskDesired,
            // scaleTasksInService,
            approximateNumberOfMessages
        })

        return {
            statusCode: 200,
            body: scaleTasksInService
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
