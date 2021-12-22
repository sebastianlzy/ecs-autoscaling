const AWS = require('aws-sdk');
const http = require("http");

const fetch = async (url) => {
    return new Promise((resolve, reject) => {
        http
            .get(url, (resp) => {
                let data = "";
                resp.on("data", (chunk) => {
                    data += chunk;
                });
                resp.on("end", () => {
                    resolve(data);
                });
            })
            .on("error", (err) => {
                reject(err);
            });
    });
};

exports.main = async function(event, context) {
    try {
        const baseUrl = process.env.BASE_URL

        const noOfMessageToSend = Math.floor(Math.random() * 100)
        const url = `${baseUrl}send-message?noofmessage=${noOfMessageToSend}`
        await fetch(url);


        return {
            statusCode: 200,
            body: url
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