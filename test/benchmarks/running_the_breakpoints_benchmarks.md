## Running the breakpoints benchmarks

> Purpose: to test GRPC/REST-JSON clients request throughput with
> a reasonably sized static list_breakpoints payload

### GRPC
* cd the `tests/benchmarks` directory
* run `node listBreakpointGRPCServer.js` in one terminal/tab
	* this will start the GRPC server on port `50051`

* run `node listBreakpointGRPCClient.js` in another terminal/tab
	* this will start the client which automatically start requesting against the server

* Voila! Enjoy the benchmarking - the client will print elasped results at the end of execution.


### REST-JSON
* cd the `tests/benchmarks` directory
* run `node listBreakpointRestServer.js` in one terminal/tab
	* this will start the REST-JSON server on port `50051`

* run `node listBreakpointRestClient.js` in another terminal/tab
	* this will start the client which automatically start requesting against the server

* Voila! Enjoy the benchmarking - the client will print elasped results at the end of execution.