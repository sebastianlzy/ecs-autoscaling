// const express = require('express')
// const app = express()
// const port = 3000
// const exec = require('child_process').exec;

const { SQSClient, ReceiveMessageCommand } = require("@aws-sdk/client-sqs");


const sqsQueueURL = process.env.QUEUE_URL
const client = new SQSClient({});
console.log("PRINT ALL ENV VARIABLE")
console.log(process.env)


const processMessage = () => {
    const receiveMessageCommand = new ReceiveMessageCommand({
        QueueUrl: sqsQueueURL
    })
    client.send(receiveMessageCommand).then(
        (data) => {
            console.log("RECEIVED INFORMATION FROM QUEUE")
            console.log(data)
            console.log("===============================")
        },
        (error) => {
            console.log("ERROR RECEIVING INFORMATION FROM QUEUE")
            console.log(error)
            console.log("===============================")
        }
    );
}

setInterval(processMessage, 100)

