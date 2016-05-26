// import the http lib
var http = require('http');
// import the request body
var requestBody = require('./breakpoints_request_static.js');
// init the iterators and start/end time vars
var i = 0;
var startTime = 0;
var endTime = 0;
var PORT = 50051;
var MAX_NUMBER_REQUESTS = 4000;

var makeRequest = function ( callback ) {
  var requestStartTime = Date.now();
  var requestEndTime = 0;
  // stringify the body each time to provide simulation of a new request being
  // sent each time.
  var body = JSON.stringify(requestBody);
  var response = {};

  http.request({
    host: 'localhost'
    , port: PORT
    , method: 'POST'
    , headers: {
      'Content-Type': 'application/json'
      , 'Content-Length': body.length
    }
  }
  , ( response ) => {
    response.on('data', ( d ) => {
      // since the GRPC client actually does unmarshalling of the response from
      // protobuf simulate the parsing of the response on http since in a real
      // use-case this would actually happen.
      response = JSON.parse(d.toString());
      requestEndTime = Date.now();
      console.log(
        "# Got response on iteration:"
        , i
        , "\n\t"
        , "time elapsed:"
        , (requestEndTime-requestStartTime)
      );
      i += 1;
      callback(callback);
    })
  }).write(body);
};

var initChain = function ( callback ) {

  if ( i > MAX_NUMBER_REQUESTS ) {
    // set the end time
    endTime = Date.now()
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.log("!! Request chain completed in (ms):", (endTime-startTime));
    console.log("!! Requests completed:", MAX_NUMBER_REQUESTS);
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

    return ;
  }

  // kick off the request
  makeRequest(callback);

};

// set the start time before we kick off the chain
startTime = Date.now();
initChain(initChain);
