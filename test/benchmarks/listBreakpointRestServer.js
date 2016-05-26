// import the http lib
var http = require('http');
// import the response body
var responseBody = require('./breakpoints_response_static.js');
var PORT = 50051;

function requestHandler ( request, response ) {
  var responseStartTime = Date.now();
	var responseEndTime = 0;
  var stringifiedResponseBody = JSON.stringify(responseBody);

  response.writeHead(
    200
    , {
      'Content-Type': 'application/json'
      , 'Content-Length': stringifiedResponseBody.length
    }
  );
  response.write(stringifiedResponseBody);
  response.end();

	responseEndTime = Date.now();
	console.log(
		"# Got request and responded"
		, "\n\t"
		, "time elapsed:"
		, (responseEndTime-responseStartTime)
	);
}

var server = http.createServer(requestHandler);

server.listen(PORT, function () {
	console.log("######################################");
  console.log("REST/JSON SERVER STARTED AT PORT", PORT, "\n--");
});
