var Application = require('./Application');

//extends generic Application object - add H. Monitoring specific logic
//-------------------------------------------------------------------------------------
function ApplicationHM(appName, appPort) {
	
	//call base constructor
	Application.call(this,appName, appPort);

	//client connections list
	this.appClients = [];
	
	//authentication
	this.auth = require("http-auth");
	this.digest = {};
		
	//streaming endpoint
	this.httpStream = require('http');
	this.optionsMjpgStreamer = {
		host: 'localhost',
		port: 3334,
		path: '/?action=stream',
		method: 'GET',
		//headers: {'Transfer-Encoding': 'chunked','Connection':'close', 'Content-Type': 'video/webm'}		
	};
	
	//Gpio & Hardware
	this.Gpio = require('pi-gpio');
	this.Hardware = { MotionSensor : 8, Led : 26, Button : 12 };
	
	//sms service twilio 
	this.SmsAPI = require('twilio');
	this.SmsService = {};	
	
	//ftp 
	this.Ftp = require("ftp");
	this.FtpService = {};

	
	//alert mode and alarm
	this.AlertMode = {
		parent : {},
		Active : false,
		ActiveMotionSensor : false, //needed for the motion start delay 
		AlarmTimeSpan : 1, //minutes - in this time span, the latest webcam snapshots are uploaded to FTP
		AlarmTimer : {},		
		StartupTimeout : {}, //timer for motion sensor start delay	
		AlarmTriggered : false,
		AlarmSensitivity : 3, //max counter for reducing false alarms; only trigger real alarm when this limit is reached
		AlarmCounter : 0, //consecutive alarm triggers
		MotionStartDelay : 10000, //10 seconds
		
		Deactivate : function(){
			var parent = this.parent;
			this.Active = false;
			this.ActiveMotionSensor = false;
			this.AlarmCounter = 0;
			clearTimeout(this.StartupTimeout);
			parent.Config.Settings.monitoring.alert = this.Active;
			parent.Gpio.write(parent.Hardware.Led, 0);				
			parent.io.sockets.emit('alarm', false);
			console.log(parent.DateTimeNow() + "(!) Alert - Mode - Inactive");			
		},		
		
		Activate : function() {
			var parent = this.parent;
			this.Active = true;			
			this.ActiveMotionSensor = false;		
			this.AlarmCounter = 0;
			parent.Config.Settings.monitoring.alert = this.Active;
			parent.Gpio.write(parent.Hardware.Led, 1); // led	on
			
			//10 seconds delay so that the person can exit the sensor range	
			console.log(parent.DateTimeNow() + "(i) Alert - motion detection starts in 10 seconds..");
			this.StartupTimeout = setTimeout(function(){
				parent.AlertMode.ActiveMotionSensor = true;				
				console.log(parent.DateTimeNow() + "(i) Alert - Mode - Active");
			}, this.MotionStartDelay, parent);			
		},	
		
		UpdateState : function(alert){
			if(alert == true)
				this.Activate();					
			else 
				this.Deactivate();					
		},
		
		AlarmNotify : function(){							
			var parent = this.parent;
			this.AlarmCounter += 1; 							
			//clear AlarmCounter if the motion detection was considered fake
			setTimeout(function(){
				if(parent.AlertMode.AlarmTriggered == false && parent.AlertMode.Active == true){
						parent.AlertMode.AlarmCounter = 0;
						console.log(parent.DateTimeNow() + "(i) Alert - motion detection - reset false+ counter");
				}
			},5000, parent); // 5 seconds - interval in which max motion detection counter needs to be reached or exceeded
			
			console.log(parent.DateTimeNow() + "(!) Alert - motion detected (" + parent.AlertMode.AlarmCounter + "/" + parent.AlertMode.AlarmSensitivity + "max)");
			
			if(this.AlarmCounter >= this.AlarmSensitivity && this.Active == true) {
				this.AlarmTriggered = true;									
				//disable motion detection for predefined AlarmTimeSpan
				this.ActiveMotionSensor = false;	
				this.AlarmCounter = 0;
				//notify connected clients than Alarm is enabled
				if(parent.appClients.length > 0)
					parent.io.sockets.emit('alarm', true);
				
				//reenable motion detection after the predefined Alarm TimeSpan
				setTimeout(function(){
					parent.AlertMode.AlarmTriggered = false; //suspend alarm
					clearInterval(parent.AlertMode.AlarmTimer); //stop ftp snapshots upload										
					parent.FtpService.end(); //close ftp connection					
					parent.AlertMode.ActiveMotionSensor = true;
					parent.AlertMode.AlarmCounter = 0;					

					//notify connected clients that Alarm is over
					if(parent.appClients.length > 0) {
						parent.io.sockets.emit('alarm', false);
					}
					else{
						//stop webcam if no client connected & alarm over
						parent.Webcam.Stop();
					}		
					
					console.log(parent.DateTimeNow() + "(i) Alert - Alarm over");
				}, this.parent.AlertMode.AlarmTimeSpan * 60000, parent); //timespan is in minutes so we convert to ms
				
				//turn on webcam streaming if not already started
				if(this.parent.Webcam.Active == false)
					this.parent.Webcam.Start();
				
				//send sms notification
				//init sms service
				this.parent.SmsService = new this.parent.SmsAPI(this.parent.Config.Settings.sms.sid, this.parent.Config.Settings.sms.token); 
				this.parent.SmsService.messages.create({ 
					to: this.parent.Config.Settings.sms.to, 
					from: this.parent.Config.Settings.sms.from, 
					body: "ALARM - Home Monitoring",   
				});
				console.log(this.parent.DateTimeNow() + "(!) Alert - ALARM - sms notification sent");
										
				// upload data from streaming buffer to FTP		 
				this.parent.FtpService = new this.parent.Ftp();	
				this.parent.FtpService.connect({
						host: this.parent.Config.Settings.ftp.server,
						port: this.parent.Config.Settings.ftp.port,
						user: this.parent.Config.Settings.ftp.user,
						password: this.parent.Config.Settings.ftp.pass,
						keepalive: 10000
				});			
				console.log(this.parent.DateTimeNow() + "(!) Alert - ALARM - FTP - connecting...");			
				
				this.parent.FtpService.on('ready', function() {
					console.log(parent.DateTimeNow() + "(!) Alert - ALARM - FTP - uploading data..");			
					parent.AlertMode.AlarmTimer = setInterval(function(){	
						if(parent.Webcam.StreamingBuffer.length > 0) {
							var frame = parent.Webcam.StreamingBuffer.pop().data;				
							parent.FtpService.put(frame, parent.Config.Settings.ftp.folder + parent.DateTimeNow() + ".jpg",function(err){
								if(err) {
									console.log(parent.DateTimeNow() + "Error - Alarm Mode - Alarm Notify - FTP > " + err);  
									parent.FtpService.destroy();							
								}
							});	
						}
					},1000, parent); //1 second for each file upload						
				}, parent);
				
				this.parent.FtpService.on('error', function(err) {
					console.log(parent.DateTimeNow() + "(!) Error > FTP > " + err);			
					parent.FtpService.destroy();
				}, parent);
			}
		}
	};
	
	//webcam setup
	this.Webcam = {		
		parent : {},
		StreamingBuffer : [],
		Active: false,	
		hd : {},
		Stop: function() {
			this.parent.exec("sudo pkill mjpg_streamer");
			this.Active = false; 
			this.StreamingBuffer.length = 0;		
			console.log(this.parent.DateTimeNow() + "Webcam stopped..");			
		},		
		Start: function() {			
			var ref = {root:this.parent, parent:this};	
			
			//make sure streaming not already running & cleanup existing frames from buffer
			this.StreamingBuffer.length = 0;
			//make sure webcam is not already running
			if(this.Active == true) {
				return;
				//this.parent.exec("sudo pkill mjpg_streamer");
			}
			
			//start webcam video
			var port = this.parent.optionsMjpgStreamer.port;
			var quality = this.parent.Config.Settings.monitoring.quality;
			var fps = this.parent.Config.Settings.monitoring.fps;
			this.parent.exec("./start-webcam.sh " + quality + " " + port + " " + fps);
			this.Active = true;
			console.log(this.parent.DateTimeNow() + "Webcam view streaming started..");
			
			//get streaming data		
			setTimeout(function(){ 		
				ref.root.httpStream.get(ref.root.optionsMjpgStreamer, function(res) {
					res.on("data", function(newFrame) {
						// only add valid frames, ignore empty captures smaller than 10K
						if(newFrame !== undefined && newFrame.length > 1000 && ref.parent.Active == true) {
							var frameData = {timestamp: ref.root.DateTimeNow(), data: newFrame};
							//send image data & timestamp to clients								
							if(ref.root.appClients.length > 0)
								ref.root.io.sockets.emit("refresh view", frameData);
							//add new frame to buffer only if AlertMode is enabled
							if(ref.root.AlertMode.Active == true && ref.root.AlertMode.AlarmTriggered == true)
								ref.parent.StreamingBuffer.push(frameData);
						}
					});
					res.on("end", function(err){
						console.log(ref.root.DateTimeNow() + "Webcam HttpStreaming GET ended..");
					});
					res.on("error", function(err){
						console.log(ref.root.DateTimeNow() + "Error > HttpStream > " + err);
					});
				}).on("error", function(err) { 
						console.log(ref.root.DateTimeNow() + "Error > HttpStream > " + err);
					});
			},3000, ref); //delay to make sure webcam had time to init			
		},		
		Restart : function() {
			this.Stop();
			this.Start();
		}
	};
};


//extend generic Application object
ApplicationHM.prototype = Object.create(Application.prototype);


//init
ApplicationHM.prototype.Init = function() {	
	//call base init function
	Application.prototype.Init.call(this);
	
	var parent = this;		
	this.AlertMode.parent = this;
	this.Webcam.parent = this;
	var alert = parent.Config.Settings.monitoring.alert;	
	
	//Hardware
	//init
	console.log(parent.DateTimeNow() + "(init) hardware");
	this.Gpio.open(this.Hardware.Led, "output", function(){		
		var ledStatus = (alert == true) ? 1:0;	//alert mode	
		parent.Gpio.write(parent.Hardware.Led, ledStatus);
	});
	this.Gpio.open(this.Hardware.MotionSensor, "input", function(err){
		setInterval(function(){ 
			parent.Gpio.read(parent.Hardware.MotionSensor, function(error,value){			
				if(parent.AlertMode.Active == true && parent.AlertMode.ActiveMotionSensor == true && value == 0){					
					console.log(parent.DateTimeNow() + "(!) Alert - PIR - motion detected");
					//send sms notification & upload video frames
					parent.AlertMode.AlarmNotify(); 
				}				
			});
		}, 500); //pir motion sensor check frequency
	});
	//toggle enable or disable Alert Mode with the physical button
	this.Gpio.open(this.Hardware.Button, "input", function(err){
		setInterval(function () {
			//check button pressed status
			parent.Gpio.read(parent.Hardware.Button, function(err, value){
				//if button pressed
				if(value == 1) {
					console.log(parent.DateTimeNow() + "(i) Button pressed");
					parent.Config.Settings.monitoring.alert = !parent.Config.Settings.monitoring.alert;
					parent.Config.Write();
					parent.AlertMode.UpdateState(parent.Config.Settings.monitoring.alert);					
				}							
			});	
		}, 200);
	});
	
	//init Alert if setting is active
	console.log(parent.DateTimeNow() + "(init) alert mode status check");
	parent.AlertMode.UpdateState(parent.Config.Settings.monitoring.alert);
};


//client communication handling
ApplicationHM.prototype.ClientsListen = function() {	
	console.log(this.DateTimeNow() + "Listening for Client connections");
	var parent = this;

	this.io.sockets.on('connection', function(socket) {	
		//add new client to list
		var client = socket.handshake;
		parent.appClients.push(parent.DateTimeNow() + client.address);
		console.log(parent.DateTimeNow() + "Client Connected < " + client.address + " > ");
		
		//if Alarm is active, show in client UI
		if(parent.AlertMode.AlarmTriggered == true)
			parent.io.sockets.emit('alarm', true);
		
		//send config settings to new client
		socket.emit('update config', parent.Config.Settings);
		
		//notify all connected clients to update app clients list
		parent.io.sockets.emit('update clients', parent.appClients);
		console.log(parent.DateTimeNow() + "Client Connected - sending clients list > " + parent.appClients.length);		
		
		//start webcam if not already running
		if(parent.Webcam.Active == false) {
			console.log(parent.DateTimeNow() + "Single client connected.. starting webcam");
			parent.Webcam.Start();
		}

		socket.on('disconnect', function() {
			//remove client from list
			parent.appClients.splice(parent.appClients.indexOf(client),1);		
			console.log(parent.DateTimeNow() + "Client Disconnected < " + client.address + " > ");		
			
			//stop webcam capture if no clients connected & alert mode is inactive
	    	if(parent.appClients.length === 0 && parent.AlertMode.AlarmTriggered == false) {
				console.log(parent.DateTimeNow() + "Last client disconnect - killing webcam process..");
				if(parent.Webcam.Active == true)
				{
					parent.Webcam.Stop();
				}
			}
			if(parent.appClients.length > 0){
			//if there are other clients connected, send them the updated clients list
				parent.io.sockets.emit('update clients', parent.appClients);
			}
	  	});

		socket.on('update config quality', function(newConfig) {
			//update .ini file			
		    console.log(parent.DateTimeNow() + "Configuration <quality> changed by client..");
		    parent.Config.Settings = newConfig;
			parent.Config.Write();	
			
			//apply new quality settings
			parent.Webcam.Restart();	
	  	});

		socket.on('update config alert', function(newConfig) {
			//update .ini file			
		    console.log(parent.DateTimeNow() + "Configuration <alert mode> changed by client..");
		    parent.Config.Settings = newConfig;
			parent.Config.Write();	
			
			//apply new alarm settings
			parent.AlertMode.UpdateState(parent.Config.Settings.monitoring.alert);		
	  	});

		socket.on('error', function(err) {
		    console.log(parent.DateTimeNow() + "Error > Socket > " + err);
			socket.destroy();
	  	});
	});
};


//execution
ApplicationHM.prototype.Execute = function() {	
	//call base Execute function
	Application.prototype.Execute.call(this);
	//listen for incoming client connections & messages
	this.ClientsListen();	
};



//cleanup before exitting app - stop all webcam captures & close gpios
ApplicationHM.prototype.Exit = function(parent, data, err) {
	if(err)
		console.log(parent.DateTimeNow() + "Closing application err < " + err + " >");	
	if(data)
		console.log(parent.DateTimeNow() + "Closing application < " + data + " >");	
	//kill webcam server
	parent.exec("sudo pkill mjpg_streamer");	
	//reset states
	parent.AlertMode.Active = false;
	parent.AlertMode.ActiveMotionSensor = false;
	parent.AlertMode.AlarmCounter = 0;
	parent.AlertMode.AlarmTriggered = false;
	parent.Webcam.Active = false;	
	//disable hardware & exit
	parent.Gpio.close(parent.Hardware.MotionSensor);
	parent.Gpio.close(parent.Hardware.Button);		
	parent.Gpio.write(parent.Hardware.Led, 0, function(){		
		parent.Gpio.close(parent.Hardware.Led);
		//exit
		process.exit(0);
	});	
};


//init app
var HomeMonitoring = new ApplicationHM('Home Monitoring', 3333);
//start
HomeMonitoring.Execute();
