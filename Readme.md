# Home Monitoring with Raspberry Pi and Node.js
 
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/system.jpg?raw=true "Home Monitoring with Raspberry Pi and Node.js")
 
## Description  
 
The project is designed as a end to end solution for a DIY **Home Monitoring & Intruder Alert system**. Besides offering a live video stream on any device (web responsive client), it also actively monitors for movement with the help of a *PIR sensor*.
 
If an *Alarm* is triggered, you get a SMS notification on your phone and the snapshots taken during the *Alarm time span* (customizable - default is 1 minute) are uploaded via FTP to your server.  
 
Activation / Deactivation of the *Alarm Mode* can be done in 2 ways:  
 1. from the Web Client user interface 
 2. with a Button - for convenience reasons: it is faster than connecting from your phone / pc & toggling the Alert Mode checkbox 
    - there is a 10 seconds customizable delay which allows you to move out of the PIR sensor range 
    - a Led indicates the Alarm Mode enabled/disabled status 
 
In order to avoid false positives from the PIR motion sensor, extra checks were added - a detection counter & detection interval. The Alarm gets triggered when the sensor detects movement 3 times in 5 seconds (both values configurable in code).
 
## Technology 
 
The project was developed using: 
- [Raspberry Pi](http://raspberrypi.org) - [raspbian](https://www.raspbian.org/), brick button & led, Pir sensor
- [Node.js](https://nodejs.org/en/) - for the main application 
- [Mjpg_streamer](http://sourceforge.net/projects/mjpg-streamer/) - to generate the video stream 
- Shell scripting - for easy application start (interactive & background) 
- Htms/Css/Javascript + [Bootstrap](http://getbootstrap.com/) - the web client  
 
## Project components 
 
### Hardware 
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/diagram.PNG?raw=true "Pir Button Led RaspberryPi Gpio")
```javascript
this.Gpio = require('pi-gpio');
this.Hardware = { MotionSensor : 8, Led : 26, Button : 12 };
```
- Raspberry Pi 
  - I used *Model B Revision 2* with *Raspbian* - any model should be Ok, just be careful with the Gpio configuration pin mappings, they can differ 
  - Generic USB webcam (compatible with Raspberry Pi & Raspbian) 
  - You can find a comprehensive list here http://elinux.org/RPi_USB_Webcams  
  - I used a very old 2MP one which seems to work out of the box with the generic drivers 
- Led & Button  
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/button-led-brick.png?raw=true "Brick Button Led")
- PIR motion sensor 

![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/pir.jpg?raw=true "PIR sensor")
  - The one I used is available here https://www.sparkfun.com/products/13285  
  - It normally connects to Analog Input (ex. on Arduino); however you can use it with Digital as well if you connect a 10K resistor between VCC & Signal  
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/pir-10k-resistor.jpg?raw=true "PIR resistor") 
  - To make things easier you can purchase this sensor https://www.adafruit.com/products/189 and skip the soldering part (+ this one has configurable sensitivity built-in, so you might be able to skip the one implemented in the code)    
 
### Node application 
 
#### Dependencies 
- express: ^4.12.3 
- ftp: ^0.3.10 
- http-auth: ^2.2.8 
- ini: ^1.3.4 
- pi-gpio: 0.0.7 
- socket.io: ^1.3.5 
- twilio: ^2.3.0 
 
The dependencies you install with NPM: 
```
npm install module --save
```
 
#### Generic ```Application.js```
It is the basic application object, defined to be reusable in other projects 
Contains the basic server code, generic config file read/write operations, generic Init & Execute & Exit methods implementations 
 
#### Home Monitoring ```ApplicationHM.js``` 
- config.ini file 
  - default video quality & alert mode settings
  - Twilio sms Api *Sid*, *Token*, *To* number, *From* number 
  - Ftp settings
- Authentication (digest http authentication) - defaults are **admin** & **password** :) 
  - You can change them from the ```htdigest``` file (nice helper tool here http://websistent.com/tools/htdigest-generator-tool/ ) 
  ```
  admin:Private:6982db7f1ddc36a0b47b5f8427dc3526
  ```

- Web Client application
  - Accessible from anywhere via [port forwarding](https://en.wikipedia.org/wiki/Port_forwarding)
  - Available also on mobile (responsive web client) 
- Monitoring - gets video from [Mjpg_streamer](http://sourceforge.net/projects/mjpg-streamer/) server and sends it to the connected app clients 
- [Mjpg_streamer](http://sourceforge.net/projects/mjpg-streamer/) was used as server, but if you prefer another tool like ffmpeg, you can easily replace it because of the loose integration via the ```start-webcam.sh``` script 

#### Alarm mode 
- Monitoring - via PIR sensor 
- Alarm - Sms notification (implemented with the help of [Twilio](https://www.twilio.com/sms)   text messaging API - very cool service, offers great Trial account for development 
- Alarm - Snapshots upload to server via Ftp 
 
### Web Client - responsive
 
The client application was designed to be accessible on all platforms (pc / tablet / mobile). 

![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/client.PNG?raw=true "Web Client")  

#### Video streaming quality settings 
By default the 480p at 25fps is enabled (initial settings are loaded from the ```config.ini``` file) 

My webcam is a low-end 5+ years old 2mp device, but for those of you with better webcams I also added 720p & 1080p 

Video resolutions & fps can be configured from the ```/static/js/script.js``` file 
```javascript
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
```
 
#### Alert Mode 
- initial state is loaded from the ```config.ini``` file 
- You can enable/disable monitoring from checkbox button in the UI 
- The state of the Alert Mode is shown both in the UI (the checkbox) but also by the LED 
- The physical Button can be also used to toggle the Alert Mode 
- All state changes are sent to all connected clients 
- If an Alarm is triggered, the UI checkbox button background will be changed to Red 
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/alarm.PNG?raw=true "Alarm")  

 
#### Connected Clients 
The dropdown shows a list of all connected clients (connection timestamp & IP) that are currently viewing the video stream  
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/clients-list.PNG?raw=true "Connected Clients List")  

 
### Shell Scripts 
 
**start-app.sh**
- You can start the application in 2 modes: 
  - Interactive (for dev / testing): ```./start-app.sh```
  - Background: ```./start-app.sh -background```
```shell
#!/bin/bash
# application start in interactive or background mode
#arguments:  [-background]

cd /home/pi/Desktop/rpiWorkspace/Node/HomeMonitoring/

if [ "$1" = "-background" ]; then
	sudo nohup node ./App-home-monitoring.js &>log.txt &
else
	sudo node ./App-home-monitoring.js 
fi
```
  
**start-webcam.sh**
- Used by the application to enable/disable video streaming when clients are connected or when an Alarm is triggered by the PIR sensor. 
```shell
#!/bin/bash
# webcam video stream
# arguments:  [resolution] [port] [fps]

pkill mjpg_streamer

sudo nohup ./mjpg-streamer/mjpg_streamer -i "./mjpg-streamer/input_uvc.so -y -r $1 -f $3 -q 75" -o "./mjpg-streamer/output_http.so -n -p $2" &
```

## Application Execution Session example
![Alt text](https://github.com/orosandrei/Home-Monitoring-Raspberry-Pi-Node/raw/master/screenshots/session.PNG?raw=true "Application Execution Session example")  

---
 
**TO DO** 
- Port the application to Windows 10 Iot on Raspberry Pi 2 
- Support for uploading snapshots to cloud (OneDrive / Dropbox) when an Alarm is triggered 
 
**References** 
- Raspberry Pi https://www.raspberrypi.org/  
- Node - https://nodejs.org/en/  
- Mjpg_streamer http://sourceforge.net/projects/mjpg-streamer/  
- SMS Api - Twilio - https://www.twilio.com/sms  
- Bootstrap http://getbootstrap.com/ 
- App Webcam Icon - https://www.iconfinder.com/icons/71274/webcam_icon#size=128  


---
**Links**
- Blog post about project [Home Monitoring with Raspberry Pi & Node](http://andreioros.com/blog/home-monitoring-raspberry-pi-node/%20)
- [Hackster.io project page](https://www.hackster.io/andreioros) 
- twitter [@orosandrei](https://twitter.com/orosandrei)
