const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8765 });

let genCount = 0;
let frameCount = 0;
const GEN_COUNT = 10;

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    console.log(`[SERVER]: <<< received message of type ${data.type} and ID ${data.messageId}`);
    if (data.type === 'generation') {
      setTimeout(() => {
        ws.send(JSON.stringify({ messageId: data.messageId, type: 'generation', data: { generation: ++genCount} }));
      }, 500);
    } else {
      const ids = Object.keys(data.data);
      const resultData = ids.map(id => ({ [id]: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2] })).reduce((acc, pos) => ({...acc, ...pos}), {});
      // use this for circular movement of all snakes
      // const x = Math.cos(Date.now() / 800);
      // const y = Math.sin(Date.now() / 800);
      // const resultData = ids.map(id => ({ [id]: [x, y] })).reduce((acc, pos) => ({...acc, ...pos}), {});
      if (frameCount >= GEN_COUNT) {
        frameCount = 0;
        ws.send(JSON.stringify({
          messageId: -1,
          type: 'generation',
          data: { generation: genCount++ },
        }));
      } else {
        setTimeout(() => {
          ws.send(JSON.stringify({
            messageId: data.messageId,
            type: 'data',
            data: {
              prediction: resultData,
              progress: frameCount++ / GEN_COUNT,
            },
          }));
        }, 20);
      }
    }
  });
});

console.log('[SERVER]: listening on port 8765');
