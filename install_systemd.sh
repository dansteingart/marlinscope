#! /bin/bash
#first make start sh's 

NODE=$(which node)
echo $NODE

PYTHON=$(which python)
echo $PYTHON

#marlinscope
echo "#!/bin/bash
rm -rf persist/
$NODE server.js 9002" > start.sh


#now making system file

echo "[Unit]
Description=marlinscope
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
Environment=PITHY_BIN=$PYTHON
User=$USER
WorkingDirectory=$PWD
ExecStart=/bin/bash $PWD/start.sh

[Install]
WantedBy=multi-user.target
" > marlinscope.service

sudo mv marlinscope.service /etc/systemd/system/marlinscope.service
sudo systemctl daemon-reload
sudo systemctl enable marlinscope
sudo systemctl start marlinscope
