#!/bin/bash
# application start in interactive or background mode
#arguments:  [-background]

cd /home/pi/Desktop/rpiWorkspace/Node/HomeMonitoring/

if [ "$1" = "-background" ]; then
	sudo nohup node ./App-home-monitoring.js &>log.txt &
else
	sudo node ./App-home-monitoring.js 
fi

