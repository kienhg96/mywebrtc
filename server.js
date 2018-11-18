const WebSocket = require('ws');

const wss = new WebSocket.Server({
	port: 8080
});

const users = [];
let index = 0;

wss.on('connection', ws => {
	ws.id = index++;
	users.push(ws);
	console.log("A Client Connected", ws.id);
	ws.on('message', msg => {
		const { type } = JSON.parse(msg);
		const target = users.find(_ws => _ws !== ws);
		console.log("Send " + type + " From " + ws.id + " To " + target.id);		
		if (target) {
			target.send(msg);
		} else {
			console.log("Target Not Found");
		}
	});
	ws.on('close', () => {
		console.log("A Client Disconnected");
		const index = users.indexOf(ws);
		users.splice(index, 1);
	});
});
