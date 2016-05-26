/**
 * Copyright 2014, 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var crypto = require('crypto');
var pjson = require('../package.json');
var utils = require('@google/cloud-diagnostics-common').utils;
var DebugTransport = require('./debugTransport');
var StatusMessage = require('./apiclasses.js').StatusMessage;

/** @const {string} Cloud Debug API endpoint */
var API = 'https://clouddebugger.googleapis.com/v2/controller';

/* c.f. the Java Debugger agent */
/** @const {string} */ var DEBUGGEE_MODULE_LABEL = 'module';
/** @const {string} */ var DEBUGGEE_MAJOR_VERSION_LABEL = 'version';
/** @const {string} */ var DEBUGGEE_MINOR_VERSION_LABEL = 'minorversion';

/** @const {Array<string>} list of scopes needed to operate with the debug API */
var SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/cloud_debugletcontroller'
];

/**
 * @constructor
 */
function DebugletApi(descriptor) {
  /** @private {Object} request style request object */
  // this.request_ = utils.authorizedRequestFactory(SCOPES);
  this.debugTransport_ = null;// new DebugTransport(SCOPES);

  /** @private {string} numeric project id */
  this.project_ = null;

  /** @private {string} debuggee id provided by the server once registered */
  this.debuggeeId_ = null;

  /** @private {string} a descriptor of the current code version */
  this.descriptor_ = descriptor;

  this.sourceContext_ = null;
  this.logger = null;
}

/**
 * Initializes the Debuglet API. It requires a unique-id 'uniquifier' string
 * that identifies the version of source we have available on this client so
 * that it can be uniquely identified on the server.
 * @param {!string} uid unique identifier for the version of source loaded
 *     in the client
 * @param {Logger} logger a logger
 * @param {!function(?Error)} callback
 */
DebugletApi.prototype.init = function(uid, logger, callback) {
  var self = this;
  this.logger = logger;
  self.uid_ = uid;
  self.nextWaitToken_ = null;

  // read project number information
  this.setProjectNumber(
    logger,
    (err, project) => {
      // if an error was reported by the project number read we must
      // terminate execution becuase our target is still undefined.
      if (err) {
        callback(err);

        return ;
      }
      // otherwise, attempt to read the source context JSON file
      this.readSourceContext(
        logger,
        (err, sourceContext) => {
          // lastly, init the transport for use with the debugger service
          this.initTransport(logger);
          callback(null, this);
        }
      );
    }
  );

  // this.setProjectNumber(logger, function (err, project) {
  //   if (err) {
  //     callback(err);
  //
  //     return ;
  //   }
  //   self.readSourceContext(logger, function (err, sourceContext) {
  //     self.initTransport(logger, function (err, transport) {
  //       if (err) {
  //         callback(err);
  //
  //         return ;
  //       }
  //       // successfully inited client
  //       callback(null);
  //     });
  //   });
  // });
};

DebugletApi.prototype.setProjectNumber = function(logger, callback) {
  var self = this;

  utils.getProjectNumber(function (err, project) {
    self.onGCP = !!project;

    if (process.env.GCLOUD_PROJECT) {
      self.project_ = process.env.GCLOUD_PROJECT;
      callback(null, self.project_);

      return ;
    }

    if (err) {
      callback(err, null);

      return ;
    }
    self.project_ = project;
    callback(null, self.project_);
  });
};

DebugletApi.prototype.readSourceContext = function(logger, callback) {
  var self = this;

  fs.readFile('source-context.json', 'utf8', function(err, data) {
    try {
      self.sourceContext_ = JSON.parse(data);
    } catch (e) {
      logger.warn('Malformed source-context.json file.');
      // But we keep on going.
      callback(null, null);
    }
    callback(null, self.sourceContext_);
  });
};

DebugletApi.prototype.initTransport = function (logger, callback) {
  var self = this;

  this.debugTransport_ = new DebugTransport(SCOPES,
    "clouddebugger.googleapis.com");
  this.debugTransport_.createChannelCredentials();
  this.debugTransport_.createChannelClient();
};

/**
 * Register to the API
 * @param {!function(?Error,Object=)} callback
 */
DebugletApi.prototype.register = function(callback) {
  this.register_(null, callback);
};


/**
 * Register an error to the API
 * @param {!string} errorMessage to be reported to the Debug API
 */
DebugletApi.prototype.registerError = function(message) {
  this.register_(message, function() {});
};


/**
 * Register to the API (implementation)
 * @param {?string} errorMessage Should be null for normal startup, and non-
 *     null if there is a startup error that should be reported to the API
 * @param {!function(?Error,Object=)} callback
 * @private
 */
DebugletApi.prototype.register_ = function(errorMessage, callback) {

  var cwd = process.cwd();
  var mainScript = path.relative(cwd, process.argv[1]);
  var projectId = this.sourceContext_.cloudRepo.repoId.projectRepoId.projectId;
  var repoName = this.sourceContext_.cloudRepo.repoId.projectRepoId.repoName;
  var revisionId = this.sourceContext_.cloudRepo.revisionId;
  var CloudBuilder = this.debugTransport_.getCloudDebuggerV2Builder();
  var SourceBuilder = this.debugTransport_.getDevToolsSourceV1Builder();

  var version = 'google.com/node-' +
    (this.onGCP ? 'gcp' : 'standalone') +
    '/v' + pjson.version;
  var desc = process.title + ' ' + mainScript;
  var labels = {
    'main script': mainScript,
    'process.title': process.title,
    'node version': process.versions.node,
    'V8 version': process.versions.v8,
    'agent.name': pjson.name,
    'agent.version': pjson.version,
    'projectid': this.project_
  };

  if (process.env.GAE_MODULE_NAME) {
    desc += ' module:' + process.env.GAE_MODULE_NAME;
    labels[DEBUGGEE_MODULE_LABEL] = process.env.GAE_MODULE_NAME;
  }

  if (process.env.GAE_MODULE_VERSION) {
    desc += ' version:' + process.env.GAE_MODULE_VERSION;
    if (process.env.GAE_MODULE_VERSION !== 'default') {
      labels[DEBUGGEE_MAJOR_VERSION_LABEL] = process.env.GAE_MODULE_VERSION;
    }
  }

  if (this.descriptor_) {
    desc += ' description:' + this.descriptor_;
  }

  if (process.env.GAE_MINOR_VERSION) {
    labels[DEBUGGEE_MINOR_VERSION_LABEL] = process.env.GAE_MINOR_VERSION;
  }

  var uniquifier = [desc, version, this.uid_, this.sourceContext_,
    JSON.stringify(labels)].join("");
  uniquifier  = crypto.createHash('sha1').update(uniquifier).digest('hex');


  var debuggee = new CloudBuilder.RegisterDebuggeeRequest({
    debuggee: new CloudBuilder.Debuggee({
        project: this.project_,
        uniquifier: uniquifier,
        description: desc,
        agent_version: version,
        labels: labels,
        source_contexts: [
            new SourceBuilder.SourceContext({
                cloud_repo: new SourceBuilder.CloudRepoSourceContext({
                    repo_id: new SourceBuilder.RepoId({
                        project_repo_id: new SourceBuilder.ProjectRepoId({
                            project_id: projectId,
                            repo_name: repoName
                        })
                    }),
                    revision_id: revisionId
                })
            })
        ]
    })
  });

  this.debugTransport_.registerDebuggee(debuggee,
    this.handleRegisterResponse_.bind(this, callback));
};

DebugletApi.prototype.handleRegisterResponse_ = function (callback, err, response) {

  if (err) {
    callback(new Error(err));
  } else if (response.debuggee.isDisabled) {
    callback('Debuggee is disabled on server');
  } else {
    this.debuggeeId_ = response.debuggee.id;
    callback(null, response);
  }
}


/**
 * Fetch the list of breakpoints from the server. Assumes we have registered.
 * @param {!function(?Error,Object=,Object=)} callback accepting (err, response, body)
 */
DebugletApi.prototype.listBreakpoints = function(callback) {

  assert(this.debuggeeId_, 'should register first');
  var CloudBuilder = this.debugTransport_.getCloudDebuggerV2Builder();
  var requestBody = {
    debuggee_id: this.debuggeeId_,
    success_on_timeout: true
  };

  if (this.nextWaitToken_) {
    requestBody.wait_token = this.nextWaitToken_;
  }

  var listBreakpoints = new CloudBuilder
    .ListActiveBreakpointsRequest(requestBody);

  this.debugTransport_.listActiveBreakpoints(listBreakpoints,
    this.handleListBreakpointsResponse_.bind(this, callback));
};

DebugletApi.prototype.handleListBreakpointsResponse_ = function(callback, err, response) {
  
  if (err) {
    callback(err);
  } else if ( !response || !response.breakpoints ) {

    console.log("Got a response of unexpected content", response);
  } else {
    this.nextWaitToken_ = response.next_wait_token;
    callback(null, { statusCode: 200 }, response);
    // console.log("Got response", response);
  }
};

/**
 * Update the server about breakpoint state
 * @param {!Breakpoint} breakpoint
 * @param {!Function} callback accepting (err, body)
 */
DebugletApi.prototype.updateBreakpoint = function(breakpoint, callback) {
    assert(this.debuggeeId_, 'should register first');

    var CloudBuilder = this.debugTransport_.getCloudDebuggerV2Builder();
    var breakpoint = new CloudBuilder.UpdateActiveBreakpointRequest({
      debuggee_id: this.debuggeeId_,
      breakpoint: Object.assign({}, breakpoint, { action: 'capture', is_final_state: true })
    });

    this.debugTransport_.updateActiveBreakpoint(message, undefined, undefined,
      this.handleUpdateBreakpointResponse_.bind(this, callback));
};

DebugletApi.prototype.handleUpdateBreakpointResponse_ = function (callback, err, response) {

  if (err) {
    callback(new Error(err), null);
  } else {
    callback(null, response);
  }
};

module.exports = DebugletApi;
