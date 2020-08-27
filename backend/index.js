let express = require('express');
let app = express();
var server = app.listen(process.env.PORT || 3002);
// let server = require('http').Server(app);
let io = require('socket.io')(server);
let stream = require('./ws/stream');

const cors = require('cors');
app.get('/', (req, res) => {
    res.send('<h1>Hey Socket.io</h1>');
});

app.use(cors({origin: true, credentials: true}));
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    next();
});

io.of('/stream').on('connection', stream);

// app.listen(process.env.PORT || 3002, function (err) {
//     if (err) {
//         console.log(err);
//     } else {
//         console.log("server Running on: ", process.env.PORT || 3002);
//     }
// });

// server.listen(3002);

// server.on('listening', onListening);

// function onListening() {
//
//     var addr = server.address();
//     var bind = typeof addr === 'string'
//         ? 'pipe ' + addr
//         : 'port ' + addr.port;
//     ('Listening on ' + bind);
//     console.log('server listening on port ' + addr.port)
// }
