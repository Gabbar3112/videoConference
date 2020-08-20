let express = require( 'express' );
let app = express();
let server = require( 'http' ).Server( app );
let io = require( 'socket.io' )( server );
let stream = require( './ws/stream' );

app.get('/', (req, res) => {
    res.send('<h1>Hey Socket.io</h1>');
});

io.of( '/stream' ).on( 'connection', stream );

server.listen( 3002 );

server.on('listening', onListening);

function onListening() {

    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    ('Listening on ' + bind);
    console.log('server listening on port ' + addr.port)
}
