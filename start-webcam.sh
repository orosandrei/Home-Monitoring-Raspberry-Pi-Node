#!/bin/bash
# webcam video stream
# arguments:  [resolution] [port] [fps]

pkill mjpg_streamer

sudo nohup ./mjpg-streamer/mjpg_streamer -i "./mjpg-streamer/input_uvc.so -y -r $1 -f $3 -q 75" -o "./mjpg-streamer/output_http.so -n -p $2" &
