var path = require('path');
var dorusu = require('dorusu');
var requestBody = require('./breakpoints_request_static.js');

var protobuf = dorusu.pb;
var buildClient = dorusu.client.buildClient;
// init the iterators and start/end time vars
var i = 0;
var startTime = 0;
var endTime = 0;
var PORT = 50051;
var MAX_NUMBER_REQUESTS = 4000;

// load in the protobuf
var builder = protobuf.loadProto({
  file: 'google/devtools/clouddebugger/v2/controller.proto',
  root: path.join(__dirname, '..', '..', 'googleapis-master')
});
/** @const {object} the builder for v2 client endpoints for cloud debugger */
var CloudBuilder = builder.google.devtools.clouddebugger.v2;
/** @const {object} the builder for v2 service requests for cloud debugger */
var Controller2 = CloudBuilder.Controller2;
/** @const {object} the builder for v1 client endpoints - used in some v2 payloads */
var SourceBuilder = builder.google.devtools.source.v1;

// build the client from the protobuf definition
var client = buildClient(Controller2.client);
//
var controller = new client({
  host: 'localhost'
  , plain: true
  , port: PORT
  , protocol: 'http:'
});

var makeRequest = function ( callback ) {
  // simulate building the request each time since the message
  // will be different in most cases
  var requestStartTime = Date.now();
  var requestEndTime = 0;
  var listBreakpoints = new CloudBuilder
    .ListActiveBreakpointsRequest(requestBody);

  controller.listActiveBreakpoints(listBreakpoints, (response) => {
      response.on('data', function (pb) {
        requestEndTime = Date.now();
        console.log(
          "# Got response on iteration:"
          , i
          , "\n\t"
          , "time elapsed (ms):"
          , (requestEndTime-requestStartTime)
        );
        i += 1;
        callback(callback);
      });
  });
}

var initChain = function ( callback ) {

  if ( i > MAX_NUMBER_REQUESTS ) {
    endTime = Date.now();
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.log("!! Request chain completed in (ms):", (endTime-startTime));
    console.log("!! Requests completed:", MAX_NUMBER_REQUESTS);
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

    return ;
  }

  // kick off the request
  makeRequest(callback);

}

// set the start time before we kick off the chain
startTime = Date.now();
initChain(initChain);
