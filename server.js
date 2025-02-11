/* 
EnderScope (based on NodeForwader): an serial to http proxy driven by ghetto get calls
requirements with some ender3 control hacks
   -- serialport -> npm install serialport
   -- express -> npm install express
   -- sleep -> npm install sleep
   -- socket.io -> npm install socket.io
   -- cors -> npm install cors

to start: node nodeforwader.js [HTTP PORT] [SERIAL PORT] [BAUD] [BUFFER LENGTH]
to read: http://[yourip]:[spec'd port]/read/  -> returns the last [BUFFER LENGTH] bytes from the serial port as a string
to write: http://[yourip]:[spec'd port]/write/[YOUR STRING HERE]

what will probably create farts/list of things to deal with later if I need to:
- returning characters that html has issues with
- spaces in the url

TODO as of 2021-12-31:

[x] Update Parser and buffer handling
[x] POST calls
[x] v4l2 controls
[x] absolute movement (maybe consolidate fields later)
[x] project saving
[ ] move some functionality to server for broader API ease
	[x] position get
	[x] v4l2-list
	[ ] v4l2-set [hard edge]


*/

parts = process.argv

if (parts.length < 2)
{
	console.log("usage: node nodeforwader.js [HTTP PORT] [SERIAL PORT (optional)] [BAUD (optional)] [BUFFER LENGTH (optional)]")
	process.exit(1);
}

else
{
	console.log(parts);
	hp = parts[2]
	try{sp = parts[3]}             catch(e){sp = undefined} 
	try{baud = parseInt(parts[4])} catch(e){baud = undefined}
	try{blen = parseInt(parts[5])} catch(e){blen = 10000}
}

const {exec} = require('child_process');
const {spawn} = require('child_process');

var bodyParser = require('body-parser');
var express = require('express')
var app = express();
var fs = require('fs');
var cors = require('cors')
const server = require('http').createServer(app);
var io = require('socket.io')(server,{cors:{methods: ["GET", "POST"]}});

const SerialPort = require('serialport');

server.listen(hp);

function msleep(n) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
  }
  function sleep(n) {
	msleep(n*1000);
  }

  var lh = 0;



  let serialPort;
  let currentPath = '/dev/tty-usbserial1'; // Default path
  
  function initializeSerialPort(path,baud) {
	  if (serialPort && serialPort.isOpen) {
		  console.log('Closing current serial port...');
		  serialPort.close((err) => {
			  if (err) {
				  console.error('Error closing serial port:', err.message);
			  } else {
				  console.log('Serial port closed successfully.');
				  createNewPort(path,baud);
			  }
		  });
	  } else {
		  createNewPort(path,baud);
	  }
  }
  
  function createNewPort(path,baud) {
	  console.log(`Initializing serial port with path: ${path}`);
	  serialPort = new SerialPort(path, { baudRate: baud });
  
	  // Attach event listeners
	  serialPort.on('open', () => {
		  console.log('Serial port opened:', path);
		  if (process.env.CADET=="true") setTimeout(()=>{sender=true},10000);
		  else sender = true;
		  setInterval(()=>{if (sender) serialPort.write("M114\r\n")},250);

	  });
  
		//last heard
		serialPort.on('data', function(data) {
		
		
		buf += data.toString('binary') 
		lh = new Date().getTime()
		if (buf.length > blen) buf = buf.substr(buf.length-blen,buf.length) 
		io.emit('data', data.toString('utf8'));
		
		});
  
	  serialPort.on('error', (err) => {
		  console.error('Serial port error:', err.message);
	  });
  
	  serialPort.on('close', () => {
		  console.log('Serial port closed');
	  });
  
	  currentPath = path; // Update the current path
  }
  
  // API to change the path dynamically
  function changeSerialPortPath(newPath) {
	  console.log(`Changing serial port path from ${currentPath} to ${newPath}`);
	  initializeSerialPort(newPath);
  }
  


if (sp != undefined) initializeSerialPort(sp,baud)

//On Data fill a circular buf of the specified length
buf = ""



//Enable Cross Site Scripting
app.use(cors())

app.use('/static',express.static('static'))
app.use('/files',express.static('files'))

//Allows us to rip out data?
app.use(bodyParser.urlencoded({extended:true})); //deprecated not sure what to do here....
app.use(bodyParser.json())

//Write to serial port
app.get('/write/*',function(req,res){	
	toSend = req.originalUrl.replace("/write/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend)
	res.send(toSend)
});

massage = undefined

  // Attempt to reconnect the serial port
app.get('/reconnect', async (req, res) => {initializeSerialPort(sp,baud); res.send("foo") });

app.get('/disconnect', async (req, res) => {try{serialPort.close()} catch(e){console.log(e)}; res.send("foo")});

app.post('/reconnect',async (req, res) => {x=req.body;initializeSerialPort(x['sp'],parseInt(['baud'])); res.send("foo") })
  
app.get("/list_ports", async(req,res)=>{res.send(await SerialPort.list())});

app.get('/writecf/*',function(req,res){	
	toSend = req.originalUrl.replace("/writecf/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend+"\r\n")
	res.send(toSend)
});

//suuuuuuupppeeer dangerous but I'm being lazy now
app.post("/exec",function(req,res){    
	x = req.body
	channel = x['channel']
	if (channel == undefined) channel = 'exec'
	toExec = x['payload']
	exec(toExec, (error, stdout, stderr) => {io.emit(channel,stdout+"|"+stderr)})
	res.send({'status':'doing it'})
});

app.post("/proc",function(req,res){    
	x = req.body
	channel = x['channel']
	if (channel == undefined) channel = 'exec'
	cmd = x['payload']
	p1 = cmd.split(" ")[0]
	p2 = cmd.split(" ").slice(1)
	test = spawn(p1,p2)
	test.stdout.on('data',(data)=>{io.emit(channel,data.toString())})
	test.stderr.on('data',(data)=>{io.emit(channel+"_err",data.toString())})
	res.send({'status':'doing it'})
});


//get and parse out v42l controls as JSON
app.post("/v4l2-ctl-list",function(req,res){    
	exec("v4l2-ctl -l", (error, stdout, stderr) => {
		console.log(stdout)
		ctls = parse_v4l2_controls(stdout)
		res.send({'status':'success','stdout':stdout,'stderr':stderr,'ctls':ctls})
	})
});

//send current position
app.get("/get_current_position",(req,res)=>{res.send({'status':'success','current_position':current_position})});

app.get("/get_camera_port",(req,res)=>{res.send({'status':'success','camera_port':settings['camera_port']})});


app.post("/run",function(req,res){    
	exec(req.body['payload'], (error, stdout, stderr) => {
		res.send({'status':'success','stdout':stdout,'stderr':stderr})
	})
});

settings      = JSON.parse(fs.readFileSync("settings.json"))

//snapshot saving
app.post("/snapshot",function(req,res){ 
	try  {x = JSON.parse(req['body'])}
	catch (e)  {x = req['body']}   
	console.log(x)
	project       = x['project'].replaceAll("/","_")
	prefix        = x['prefix']
	user          = x['user']
	date          = x['date']
	notes         = x['notes']
	position      = x['position']
	projects_path = settings["projects_path"]
	snapshot_url  = settings["snapshot_url"]


	//we're going to save the snapshot to a give (project) (dir) with the following format
	fn = `${projects_path}/${project}/${prefix}_${position['x']}_${position['y']}_${position['z']}_${date}.jpg`
	fnl = fn.replace(".jpg",".json")
	cmd = `curl ${snapshot_url} --create-dirs --output ${fn}`
	log = req.body
	log['fn'] = fn
	console.log(log)
	exec(cmd, (error, stdout, stderr) => {

		var logStream = fs.createWriteStream(fnl, {flags: 'a'});
		logStream.end(JSON.stringify(log)+"\n");
		res.send({'status':'success','stdout':stdout,'stderr':stderr})
	})

});

//get projects
app.post("/projects",(req,res)=>{
	x = req.body;
	if (x['project'] == undefined) glob("files/*",(e,files)=>{res.send(files)})
	else glob(`files/${x['project']}/*.jpg`,(e,files)=>{res.send(files)})
})



//#expects data to be in {'payload':data} format
app.post('/write',function(req,res){    
	x = req.body
	toSend = x['payload']
	console.log(toSend)
	serialPort.write(toSend)
	res.send(toSend)
});

//Show Last Updated
app.get('/lastread/',function(req,res){	
	lhs = lh.toString();
	res.send(lhs)
});

//read buffer
app.get('/read/', function(req, res){ res.send(buf) });


//weak interface
app.get('/', function(req, res){ res.sendFile(__dirname + '/static/html/index.html');});
app.get('/console',   function(req, res){ res.sendFile( __dirname + '/static/html/console.html');});
app.get('/projects*', function(req, res){ res.sendFile( __dirname + '/static/html/projects.html');});


//sockets
io.on('connection', function(socket){
	if (sp != "NONE") io.emit('data',buf);
	socket.on('input', function(msg){serialPort.write(msg+"\r\n")});
});




//marklin functions
//helper fuctions
function parse_v4l2_controls(str)
{
	cntls = str.trim().split("\n")
	obj = {}
	for (c in cntls)
	{
		if (cntls[c].search(":") > -1)
		{
			cntl = cntls[c].trim().split(":")
			nn = cntl[0].split(" ")[0]
			obj[nn] = {}
			obj[nn]['hex']  = cntl[0].split(" ")[1]
			obj[nn]['type'] = cntl[0].split(" ")[2]
			for (a in cntl[1].trim().split(" "))
			{
				aa = cntl[1].trim().split(" ")[a].split("=");
				obj[nn][aa[0]]=aa[1]
			}
		}
	}
	
	return obj
}




poslog = ""
current_position = undefined
if (sp == "NONE") current_position = {'status':'no stage'}


function find_position(msg)
{
	poslog += msg
	pat = /(?=X)(.*?)(?=Count)/g
	last_pos = [...poslog.matchAll(pat)]
	if (last_pos.length > 0)
	{
		out = parse_position(last_pos[last_pos.length-1][0])
		poslog="";
		return out
	}
}

function parse_position(str)
{
	parts = str.trim().split(" ")
	obj = {}
	for (p in parts) obj[parts[p].split(":")[0]] = parts[p].split(":")[1]
	return obj
}

