const express = require('express')
const app = express()
const port = 3000
const exec = require('child_process').exec;




app.get('/', (req, res) => {
    exec('uname -m', function (error, stdout, stderr) {
        if (error) throw res.error("Error: Not able to retrieve architecture");
        console.log(`I am serving from ${stdout}`)
        res.send(`I am serving from ${stdout}`)
    });

})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})