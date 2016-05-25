'use strict';

var path = require('path');
var dorusu = require('dorusu');
var protobuf = dorusu.protobuf;
var buildClient = dorusu.client.buildClient;
var googleauth = dorusu.googleauth;

/** @const {object} the core proto builder, should only need to read and parse the proto once */
var builder = protobuf.loadProto({
  file: 'google/devtools/clouddebugger/v2/controller.proto',
  root: path.join(__dirname, '..', 'googleapis-master')
});
/** @const {object} the builder for v2 client endpoints for cloud debugger */
var CloudDebuggerV2 = builder.google.devtools.clouddebugger.v2;
/** @const {object} the builder for v2 service requests for cloud debugger */
var Controller2 = CloudDebuggerV2.Controller2;
/** @const {object} the builder for v1 client endpoints - used in some v2 payloads */
var DevToolsSourceV1 = builder.google.devtools.source.v1;

var TRANSIENT_ERRORS = [429, 500, 503];
/** @const {number} */ var MAX_RETRY_ATTEMPTS = 5;
/** @const {number} */ var MIN_RETRY_TIMEOUT = 1000; // milliseconds

/**
 * The DebugTransport constructor function sets six different properties
 * on the instance, two of these are universally shared instances of proto
 * message builder namespaces: DevToolsSourceV1 and CloudDebuggerV2. This
 * constructor also takes two arguments as initialization vectors: scopes
 * and uri. Scopes is a array of strings indicating which scopes the client
 * should authenticate against and uri is the base uri for the client to
 * connect to. The last two properties GoogleAuthProvider_ and controller_
 * will be assigned once the corresponding set functions are called on the
 * the instance: createChannelCredentials and createChannelClient respectivley.
 * @class
 * @param {Array<String>} scopes - an array of scopes to authenticate against
 * @param {String} uri - a base service uri for the client to use
 */
function DebugTransport (scopes, uri) {
  this.DevToolsSourceV1 = DevToolsSourceV1;
  this.CloudDebuggerV2 = CloudDebuggerV2;

  this.scopes = scopes;
  this.uri = uri;

  this.GoogleAuthProvider_ = null;
  this.controller_ = null;
}

DebugTransport.prototype.retryDelay = function(attempt) {

  return MIN_RETRY_TIMEOUT * Math.pow(2, (attempt-1));
}

/**
 * Retrieve the CloudDebuggerV2 parsed proto message container. This is a
 * necessary interface to build Cloud Debugger proto rpc messages without
 * having app code re-reading and re-parsing the same proto file which is
 * expensive.
 * @public
 * @name getCloudDebuggerV2Builder
 * @returns {Object} -  builder.google.devtools.clouddebugger.v2 a reference to
 *  the message builder
 */
DebugTransport.prototype.getCloudDebuggerV2Builder = function() {

  return this.CloudDebuggerV2;
}

/**
 * Retrieve the DevToolsSourceV1 parsed proto message container. This is a
 * necessary interface to build DevTools/Cloud Debugger proto rpc messages
 * without having app code re-reading and re-parsing the same proto file
 * which is expensive.
 * @public
 * @name getDevToolsSourceV1Builder
 * @returns {Object} -  builder.google.devtools.source.v1 a reference to
 *  the message builder
 */
DebugTransport.prototype.getDevToolsSourceV1Builder = function() {

  return this.DevToolsSourceV1;
}

/**
 * Create and set the channel credentials on the transport instance.
 * This method does not actually set header credentials on the client instance,
 * instead this method creates the auth factory for later requests to use
 * against the service.
 * !!This method will mutate the instance by assigning its property
 * this.GoogleAuthProvider_ to an authorization factory.
 * @public
 * @name createChannelCredentials
 */
DebugTransport.prototype.createChannelCredentials = function() {
  // create the auth factory by providing the scopes to the returned closure
  // this will allow us to fetch new credentials when necessary
  this.GoogleAuthProvider_ = googleauth.addAuthFromADC(this.scopes);
}

/**
 * Create and set the channel client on the transport instance.
 * This method will create a client factory based off the Controller2
 * client proto and set it on the transport instance.
 * !!This method will mutate the instance by assigning its property
 * this.controller_ to an instance of Controller2.client client.
 * @public
 * @name createChannelCredentials
 */
DebugTransport.prototype.createChannelClient = function() {
  // create the client factory by making a stub creation function
  // based off the Controller2 client proto derivation
  var client = buildClient(Controller2.client);
  // create the actual client this transport instance will use. Since there
  // is 1-1 relationship between transport and client in this model the
  // transport instance only needs one client instance
  this.controller_ = new client({
    host: "clouddebugger.googleapis.com",
    plain: false,
    protocol: 'https:'
  });
}

/**
 * A basic request shelf: this function takes a register_debuggee message and
 * a completion callback which will be called (always) with two parameters.
 * The first of these parameters should always be considered the error and the
 * second the completion result. If no error is encountered during execution the
 * first parameter will always be null, othwerise it will be an object containing
 * error information. Upon encountering an error the second callback parameter
 * will always be null; otherwise, upon success, it will be an object containing
 * the response that the service has generated for the request.
 * @public
 * @name registerDebuggee
 * @param {google.devtools.clouddebugger.v2.RegisterDebuggeeRequest}
 *  message - the register debugee message which one would like to send.
 * @param {DebugTransport~requestCallback} callback - the error/completion callback
 */
DebugTransport.prototype.registerDebuggee = function(message, callback) {

  if (this.controller_ === null) {
    callback({ error: "Transport has not been initialized" }, null);

    return ;
  }

  this.GoogleAuthProvider_("www.googleapis.com/auth/", {},
    (err, headers) => {

      this.controller_.registerDebuggee(message, function(response) {
        response.on('data', function (pb) {
          callback(null, pb);
        });
        response.on('error', function (err) {
          callback(err, null);
        });
      }, { headers: headers });
    }
  );
}

/**
 * A basic request shelf: this function takes a list_active_breakpoints request
 * and a completion callback which will be called (always) with two parameters.
 * The first of these parameters should always be considered the error and the
 * second the completion result. If no error is encountered during execution the
 * first parameter will always be null, othwerise it will be an object containing
 * error information. Upon encountering an error the second callback parameter
 * will always be null; otherwise, upon success, it will be an object containing
 * the response that the service has generated for the request.
 * @public
 * @name listActiveBreakpoints
 * @param {google.devtools.clouddebugger.v2.ListActiveBreakpointsRequest}
 *  message - the list active break points message which one would like to send.
 * @param {DebugTransport~requestCallback} callback - the error/completion callback
 */
DebugTransport.prototype.listActiveBreakpoints = function(message, callback) {

  if (this.controller_ === null) {
    callback({ error: "Transport has not been initialized" }, null);

    return ;
  }

  this.GoogleAuthProvider_("www.googleapis.com/auth/", {},
    (err, headers) => {
      this.controller_.listActiveBreakpoints(message, function (response) {
          response.on('data', function (pb) {
            callback(null, pb);
          });
          response.on('error', function (err) {
            callback(err, null);
          });
      }, { headers: headers });
    }
  );
}

/**
 * A basic request shelf: this function takes a update_active_breakpoint request
 * and a completion callback which will be called (always) with two parameters.
 * The first of these parameters should always be considered the error and the
 * second the completion result. If no error is encountered during execution the
 * first parameter will always be null, othwerise it will be an object containing
 * error information. Upon encountering an error the second callback parameter
 * will always be null; otherwise, upon success, it will be an object containing
 * the response that the service has generated for the request.
 * @public
 * @name updateActiveBreakpoint
 * @param {google.devtools.clouddebugger.v2.UpdateActiveBreakpointRequest}
 *  message - the update active break points message which one would like to send.
 * @param {DebugTransport~requestCallback} callback - the error/completion callback
 */
DebugTransport.prototype.updateActiveBreakpoint = function(message, metadata, options, callback) {

  if (this.controller_ === null) {
    callback({ error: "Transport has not been initialized" }, null);

    return ;
  }

  this.GoogleAuthProvider_("www.googleapis.com/auth/", {},
    (err, headers) => {
      this.controller_.updateActiveBreakpoint(message, function (response) {
        response.on('data', function (pb) {
          callback(null, pb);
        });
        response.on('error', function (err) {
          callback(err, null);
        });
      }, { headers: headers });
    }
  );
}

/**
 * The DebugTransport:requestCallback is a callback which should be invoked
 * with two parameters. The first of which is an error the second: a request
 * result. Upon encountering an error the first parameter in this function
 * invocation should be an Object containing this error and any relevant info.
 * If an error is encountered the second parameter, the request result, should
 * always be null. Otherwise, if an error is not encountered and a result
 * gleamed from request completion the first parameter (error) should always be
 * null while the second argument (request result) should always be the result
 * garnered through request execution.
 * @callback DebugTransport~requestCallback
 * @param {null|object} requestError - any error encountered during execution
 * @param {null|object} requestResult - any result encountered during execution
 *  sans the presence of an request error
 */

module.exports = DebugTransport;
