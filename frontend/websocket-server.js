const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8765 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    console.log(`[SERVER]: <<< received message of type ${data.type} and ID ${data.messageId}`);
    if (data.type === 'generation' || data.type === 'reproduce') {
      setTimeout(() => {
        ws.send(JSON.stringify({ messageId: data.messageId, type: 'ack', data: {} }));
      }, 500);
    } else {
      const ids = Object.keys(data.data);
      const resultData = ids.map(id => ({ [id]: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2] })).reduce((acc, pos) => ({...acc, ...pos}), {});

      setTimeout(() => {
        ws.send(JSON.stringify({
          messageId: data.messageId,
          type: 'data',
          data: resultData,
        }));
      }, 20);
    }
  });
});

console.log('[SERVER]: listening on port 8765');
