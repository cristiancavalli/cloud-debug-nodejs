var path = require('path');
var dorusu = require('dorusu');
var responseBody = require('./breakpoints_response_static.js');

var RpcApp = dorusu.app.RpcApp;
var server = dorusu.server;
var protobuf = dorusu.pb;
var buildClient = dorusu.server;
var PORT = 50051;
var HOST = '0.0.0.0';

var builder = protobuf.loadProto({
  file: 'google/devtools/clouddebugger/v2/controller.proto',
  root: path.join(__dirname, '..', '..', 'googleapis-master')
});
/** @const {object} the builder for v2 client endpoints for cloud debugger */
var CloudDebuggerV2 = builder.google.devtools.clouddebugger.v2;
/** @const {object} the builder for v2 service requests for cloud debugger */
var Controller2 = CloudDebuggerV2.Controller2;

function respondListBreakpoints ( request, response ) {
  var responseStartTime = Date.now();
  var responseEndTime = 0;

  request.on('data', function ( msg ) {
    // This JS object will be automatically marshalled into a protobuf
    // container by dorusu
    response.write(responseBody);
  });

  request.on('end', () => {
    response.end();
    responseEndTime = Date.now();
    console.log(
      "# Got request and responded"
      , "\n\t"
      , "time elapsed:"
      , (responseEndTime-responseStartTime)
    );
  });

  request.on('error', function () {
    console.log("GOT ERROR!", arguments);
    response.end();
  });
}

var app = new RpcApp(Controller2.server);
app.register(
  '/google.devtools.clouddebugger.v2.Controller2/ListActiveBreakpoints'
  , respondListBreakpoints
);

var serverInstance = server.raw.createServer({
  app: app
  , host: HOST
});
serverInstance.listen(PORT);

console.log("#################################");
console.log("GRPC SERVER STARTED AT PORT", PORT, "\n--");
