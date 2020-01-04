const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8765 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    console.log(`[SERVER]: <<< received message of type ${data.type} and ID ${data.messageId}`);
    if (data.type === 'start' || data.type === 'epoch' || data.type === 'reproduce') {
      setTimeout(() => {
        ws.send(JSON.stringify({ messageId: data.messageId, type: 'ack', data: {} }));
      }, 1500);
    } else {
      const ids = Object.keys(data.data);
      const resultData = ids.map(id => ({ [id]: [Math.random() - 0.5, Math.random() - 0.5] })).reduce((acc, pos) => ({...acc, ...pos}), {});
      setTimeout(() => {
        ws.send(JSON.stringify({
          messageId: data.messageId,
          type: 'snakes',
          data: resultData,
        }));
      }, 2000);
    }
  });
});

console.log('[SERVER]: listening on port 8765');
