const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8765 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    if (message === 'start') {
      ws.send('ack');
    } else if (message === 'incoming') {
      ws.send('ack2');
    } else {
      ws.send('{"0":[1,1]}');
    }
  });
});
