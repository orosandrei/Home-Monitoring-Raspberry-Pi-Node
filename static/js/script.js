/* global io */
/* global $ */
$(document).ready(function() 
{
	//disable tooltips for touch-enabled screens
	if(!('ontouchstart' in document.documentElement))
		$('[data-toggle="tooltip"]').tooltip({container: 'body'});
		
		
	//properties & ui objects mappings
	var ui = {
		quality480p : $("#quality-480p"),
		quality720p : $("#quality-720p"),
		quality1080p : $("#quality-1080p"),
		alertMode : $("#alert-mode"),
		imgContainer : $("#img-container"),
		img : $("#image-view"),
		imgPreloader : $("#image-preloader"),
		imgTimestamp : $("#timestamp"),
		clientsList : $("#clients"),
		clientsCount : $("#clients-count"),	
	},	
	appConfig = {},
	appClients = [],
	socket = io.connect();  
	
	
	//notify server of connection
	socket.emit('connected'); 

	
	//get new image & update view
	socket.on('refresh view', function(imageData) {
		var arrayBuffer = new Uint8Array(imageData.data);
		var blob = new Blob([arrayBuffer], {type: "image/jpeg"});
		var urlCreator = window.URL || window.webkitURL;
		var imageUrl = urlCreator.createObjectURL(blob);
		
		//add image data to hidden preloader image, to avoid flicker
		//after it is preloaded, it it sent to the visible img
		ui.imgPreloader.attr('src', imageUrl);
		ui.imgTimestamp.html(imageData.timestamp);	
	});	
	ui.imgPreloader.load(function() {
			ui.img.attr('src',ui.imgPreloader.attr('src'));	
	});

	
	//set local settings with values received from server	
	socket.on('update config', function(newConfig) {
		appConfig = newConfig;
		
		//reset ui button inset (selected) effect for quality control buttons
		ui.quality480p.parent().removeClass("active");
		ui.quality720p.parent().removeClass("active");
		ui.quality1080p.parent().removeClass("active");
		
		//update ui based on values from new config
		switch(appConfig.monitoring.quality) {
			case "640x480":
				ui.quality480p.prop("checked", true);
				ui.quality480p.parent().addClass("active");
				break;
			case "1280x720":
				ui.quality720p.prop("checked", true);
				ui.quality720p.parent().addClass("active");
				break;
			case "1920x1080":
				ui.quality1080p.prop("checked", true);
				ui.quality1080p.parent().addClass("active");
				break;
		}
		ui.alertMode.prop("checked", appConfig.monitoring.alert);
	});
	
	
	//update app clients list with new items received from server		
	socket.on('update clients', function(serverClients) {
		//update app clients count badge
		appClients = serverClients;
		ui.clientsCount.html(serverClients.length);				
		//update app clients list
		ui.clientsList.empty();
		appClients.forEach(function(item) {
			ui.clientsList.append('<li><a href="#">' + item + '</a></li>');
		});		
	});
	
	
	//update app clients list with received Alarm state
	socket.on('alarm', function(state) {
		if(state==true)
			ui.alertMode.parent(".btn").addClass("alarm");
		else
			ui.alertMode.parent(".btn").removeClass("alarm");
	});
	
	
	//update quality client config object with values from associated ui objects
	function ConfigUpdateQuality() {	
		//only check quality settings
		if(ui.quality480p.prop('checked')) {
			appConfig.monitoring.quality = "640x480";
			appConfig.monitoring.fps = 25;
		}
		if(ui.quality720p.prop('checked')) { 
			appConfig.monitoring.quality = "1280x720";			
			appConfig.monitoring.fps = 25;
		}
		if(ui.quality1080p.prop('checked')) { 
			appConfig.monitoring.quality = "1920x1080";			
			appConfig.monitoring.fps = 25;
		}
			
		//send to server new config settings
		socket.emit('update config quality', appConfig);
	}
	
	
	//update alert client config object with values from associated ui object
	function ConfigUpdateAlert() {	
		appConfig.monitoring.alert = ui.alertMode.prop('checked');
		socket.emit('update config alert', appConfig);
	}	
	
	
	//bind ui objects to function associated with config settings update
	ui.alertMode.click(function(){ ConfigUpdateAlert(); });
	ui.quality480p.change(function(){ ConfigUpdateQuality(); });
	ui.quality720p.change(function(){ ConfigUpdateQuality(); });
	ui.quality1080p.change(function(){ ConfigUpdateQuality(); });	
	
});
