var PIUtils = require('./piutils');
var OrderManager = require('./orderManager');
var webClient = require('request');
var config = require('./config');
var cmd=require('node-cmd');

var OrderingModule = function(deviceId,rPin,bPin,gPin,buttonPin) {

    if (this.validPins.indexOf(rPin) === -1 ||
        this.validPins.indexOf(gPin) === -1 ||
        this.validPins.indexOf(bPin) === -1 ||
        this.validPins.indexOf(buttonPin) === -1 ||
        this.usedPins.indexOf(rPin) !== -1 ||
        this.usedPins.indexOf(gPin) !== -1 ||
        this.usedPins.indexOf(bPin) !== -1 ||
        this.usedPins.indexOf(buttonPin) !== -1
        )
    {
        console.log("One of pins cannot be used for IO. Bailing out!!!");
        this.functional=false;
        return;
    }
    this.functional=true;
    this.rPin = rPin;
    this.gPin = gPin;
    this.bPin = bPin;
    this.buttonPin = buttonPin;
    this.usedPins.push(rPin);
    this.usedPins.push(gPin);
    this.usedPins.push(bPin);
    this.usedPins.push(buttonPin);
    this.deviceId = deviceId;

    console.log("Creating Ordering module using PINS : "+rPin,gPin,bPin,buttonPin);

    this.rOut = PIUtils.setupForOutput(rPin);
    this.gOut = PIUtils.setupForOutput(gPin);
    this.bOut = PIUtils.setupForOutput(bPin);
    this.buttonIn = PIUtils.setupForInput(buttonPin);

    this.setStatus(this.DEFAULT);
    OrderManager.registerModule(this);

    var that = this;
    this.placeOrder = function(err,value) {
        if(value===1)
        {
            OrderManager.placeOrder(that);
            that.setStatus(that.LOCALLY_QUEUED);
        }
    }

    PIUtils.watch(this.buttonIn,  this.placeOrder);

    setInterval(OrderingModule.prototype.getStatus.bind(this),config.OM_STATUS_POLL_INTERVAL);
}

OrderingModule.prototype.getStatus = function() {
    var url = config.WEB_SERVER + "/devices/"+config.DEVICE_ID+"/device_buttons/"+this.deviceId+".json";
    console.log("Checking OM "+this.deviceId+" status");
    var that = this;
    webClient.get({url:url, timeout: config.WEB_SERVER_TIMEOUT}, function(err,httpResponse,body){
        if(!err && httpResponse.statusCode===200)
        {
            var body = JSON.parse(body);
            that.setStatus(body['status']);
        }
        else
        {
            console.log("Failed to retrieve status of om : "+that.deviceId+" "+err);
        }
    }) ;
}

OrderingModule.prototype.setStatus = function(status) {

    /*if(this.currentStatus===this.LOCALLY_QUEUED && status!==this.GETTING_READY)
    {
        console.log("OM "+this.deviceId+" : Cannot change from "+this.LOCALLY_QUEUED+" to "+status);
        return;
    } */
    console.log("OM "+this.deviceId+" : Setting status as "+status);
    switch(status) {
        case this.LOCALLY_QUEUED:
            this.currentStatus = this.LOCALLY_QUEUED;
            this.glowBlue();
            break;
        case this.GETTING_READY:
            this.currentStatus = this.GETTING_READY;
            this.glowGreen();
            break;
        case this.SHIPPED:
            if(this.currentStatus!==this.SHIPPED)
            {
                cmd.run('echo "Please note, some of your orders are shipped out for delivery" | festival --tts');
            }
            this.currentStatus = this.SHIPPED;
            this.glowWhite();


            break;
        default:
            //accept default action only if the current status is not LOCALLY_QUEUED.
            //this is to handle the case where before submitting locally queued order, server returns null as current status of this OM
            if(this.currentStatus!==this.LOCALLY_QUEUED)
                this.glowBlack();
            break;
    }
}


OrderingModule.prototype.LOCALLY_QUEUED = 'locally_queued';
OrderingModule.prototype.GETTING_READY = 'getting_ready';
OrderingModule.prototype.SHIPPED = 'shipped';
OrderingModule.prototype.RECEIVED = 'received';
OrderingModule.prototype.DEFAULT = 'default';

OrderingModule.prototype.glowBlue = function() {
    PIUtils.sendSignal(this.rOut,1);
    PIUtils.sendSignal(this.gOut,1);
    PIUtils.sendSignal(this.bOut,0);
}

OrderingModule.prototype.glowWhite = function() {
    PIUtils.sendSignal(this.rOut,0);
    PIUtils.sendSignal(this.gOut,0);
    PIUtils.sendSignal(this.bOut,0);
}

OrderingModule.prototype.glowGreen = function() {
    PIUtils.sendSignal(this.rOut,1);
    PIUtils.sendSignal(this.gOut,0);
    PIUtils.sendSignal(this.bOut,1);
}

OrderingModule.prototype.glowOrange = function() {
    PIUtils.sendSignal(this.rOut,0);
    PIUtils.sendSignal(this.gOut,1);
    PIUtils.sendSignal(this.bOut,0);
}

OrderingModule.prototype.glowBlack = function() {
    PIUtils.sendSignal(this.rOut,1);
    PIUtils.sendSignal(this.gOut,1);
    PIUtils.sendSignal(this.bOut,1);
}

//21 is used for status now
//40 is used for status as of now
OrderingModule.prototype.validPins = [
      2,3,4,14,15,17,18,27,22,23,24,10,9, 25,11,8, 7, 5, 6, 12,13,19,16,26,20,21
    //3,5,7,8, 10,11,12,13,15,16,18,19,21,22,23,24,26,29,31,32,33,35,36,37,38,40
];

OrderingModule.prototype.usedPins = [];

OrderingModule.prototype.printPins = function() {
    console.log("Pins Used : "+this.rPin+" "+this.gPin+" "+this.bPin+" "+this.buttonPin);
}

OrderingModule.prototype.tearDown = function() {
    console.log("Tearing down OrderingModule");

    if(!this.functional)
        return;
    this.rOut.tearDown();
    this.gOut.tearDown();
    this.bOut.tearDown();
    this.buttonIn.tearDown();
}


module.exports = OrderingModule