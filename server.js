const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const fs = require("fs");
const app = module.exports.app = express();


// Porta e host: servidor TCP
var serverPORT = 5000;
var serverHOST = '0.0.0.0';


// Var para o server TCP
var net = require('net');
var server = net.createServer();

server.maxConnections = 10;

//static port allocation
server.listen(serverPORT);

// Porta do servidor WEB
const portWeb = process.env.PORT || 8080;

// ---------- MONGO ---------- 
mongoose.connect('mongodb://localhost/sensordata', { useNewUrlParser: true }).then(() => {
    console.log("MongoDB connected ...");
}).catch((err)=> {
    console.log("MongoDB connection error ..." + err);
});

var InfoSensor = new mongoose.Schema({
	time: Date,
	sensor: Number,
	tmp: Number,
	hum: Number,
	lum: Number
});

var Database = mongoose.model('InfoSensor', InfoSensor);
// ---------- FIM MONGO ---------- 


// ---------- Parte WEB dos gráficos ----------
app.use(express.static('./public'));
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/', async function (req, res) {
	res.render('index');
});

// Envia os ultimos 20000 dados, para criar o gráfico inicial
app.get('/getSensors', async function (req, res) {
	const data = await Database.find().sort('-time').limit(20000);

	let response =[];
	for (const item in data){
		const values = {
			time: data[item].time,
			sensor: data[item].sensor,
			tmp: data[item].tmp,
			hum: data[item].hum,
			lum: data[item].lum
		}
		response.push(values);
	}
	res.send(JSON.stringify(response));
});
// ---------- Fim da parte WEB ---------- 


// ---------- WebSocket para enviar os novos dados: ---------- 
const serverHTTP = http.createServer(app);

const io = require('socket.io').listen(serverHTTP);

io.sockets.on('connection', function(socket) {
	socket.on('conected', function() {
		console.log('Client conected');
	});
});

//serverHTTP.listen(portWeb);
serverHTTP.listen(portWeb, function () {
	console.log('Web server running on 127.0.0.1:%d!', portWeb);
});
// ---------- Fim do WebSocket ---------- 

// ---------- Receber os dados do cliente, armazenar no banco de dados e enviar pelo WebSocket ---------- 

// Emitted when new client connects 
server.on('connection',function(socket){
	//this property shows the number of characters currently buffered to be written. (Number of characters is approximately equal to the number of bytes to be written, but the buffer may contain strings, and the strings are lazily encoded, so the exact number of bytes is not known.)

	console.log('Buffer size : ' + socket.bufferSize);
	console.log('---------server details -----------------');

	var address = server.address();
	var port 	= address.port;
	var family 	= address.family;
	var ipaddr 	= address.address;
	console.log('Server is listening at port' + port);
	console.log('Server ip :' + ipaddr);
	console.log('Server is IP4/IP6 : ' + family);
	
	var lport = socket.localPort;
	var laddr = socket.localAddress;
	console.log('Server is listening at LOCAL port' + lport);
	console.log('Server LOCAL ip :' + laddr);

	console.log('------------remote client info --------------');

	var rport   = socket.remotePort;
	var raddr   = socket.remoteAddress;
	var rfamily = socket.remoteFamily;

	console.log('REMOTE Socket is listening at port' + rport);
	console.log('REMOTE Socket ip :' + raddr);
	console.log('REMOTE Socket is IP4/IP6 : ' + rfamily);

	console.log('--------------------------------------------');
	
	//var no_of_connections =  server.getConnections(); // sychronous version
	server.getConnections(function(error,count){
		console.log('Number of concurrent connections to the server : ' + count);
	});
	
    // ----- When receive client data.
    socket.on('data', function (message) {
        // Print received client data and length.
        console.log('Receive client send data : ' + message + ', data size : ' + socket.bytesRead);
        console.log('lastData value = ' + (new Date()).getTime());
        
        var data = JSON.parse(message.toString());
		
		var instance = new Database({
			time: new Date(),
			sensor: data.Sensor,
			tmp: data.Tmp,
			hum: data.Hum,
			lum: data.Lum
		});
		
	    const values = {
		    time: new Date(),
		    sensor: data.Sensor,
		    tmp: data.Tmp,
		    hum: data.Hum,
		    lum: data.Lum
	    }
	    
	    console.log(values);
	    
	    instance.save().then(()=>{
            console.log("InfoSensor Saved ...")
        }).catch((err)=>{
            console.log("InfoSensor error ... " + err)
        })
	    
	    io.sockets.emit('newData', JSON.stringify(values));
	    
    });


    // ----- Esmitted when server closes
    // ----- Not emitted until all connections closes.
    socket.on('close', function() {
	    console.log('Connection closed');
    });
	
});


// ---------- Enviar os dados de configuração para execução dos experimentos ---------- 
function loadConfig(){

	var content = fs.readFileSync("upload_files/exp1.json");	
	var exp = JSON.parse(content);
	
	var client = new net.Socket();
	
	client.connect(1337, '127.0.0.1', function() {
		
		var message = exp;
		client.write(message);
		
		client.destroy();
	});
	
	return exp;
}

