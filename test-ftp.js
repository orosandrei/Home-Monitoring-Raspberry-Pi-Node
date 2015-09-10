this.fs = require('fs');
this.Ftp = require("ftp");	
this.FtpService = {};

this.FtpService = new this.Ftp();		

this.FtpService.connect({
	host: "",
	port: 21,
	user: "",
	password: ""
},function(err){console.log(err);});
console.log("(!) Alert - ALARM - FTP - connecting...");

var parent = this;

this.FtpService.on('ready', function(err) {
	console.log(err);
	
	console.log("(!) Alert - ALARM - FTP - uploading data..");				
	parent.fs.writeFile("./test.jpg", "test", function(err) {
		if(err) { return console.log(err); }					
	});
	
	parent.FtpService.put("./test.jpg", "" + "/rpiHomeMonitoring/test.jpg", function(err) {
		if (!err) console.log("File transferred successfully!");
		else console.log(err);
	});				
	parent.FtpService.end();
}, parent);	