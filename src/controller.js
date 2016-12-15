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

/*!
 * @module debug/controller
 */

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var crypto = require('crypto');
var pjson = require('../package.json');
var qs = require('querystring');
var utils = require('@google/cloud-diagnostics-common').utils;
var StatusMessage = require('./status-message.js');

/** @const {string} Cloud Debug API endpoint */
var API = 'https://clouddebugger.googleapis.com/v2/controller';

/* c.f. the Java Debugger agent */
/** @const {string} */ var DEBUGGEE_MODULE_LABEL = 'module';
/** @const {string} */ var DEBUGGEE_MAJOR_VERSION_LABEL = 'version';
/** @const {string} */ var DEBUGGEE_MINOR_VERSION_LABEL = 'minorversion';


/**
 * @constructor
 */
function Controller(config, debug) {
  config = config || {};

  /** @priavate {Debug} */
  this.debug_ = debug;

  /** @private {string} numeric project id */
  this.project_ = null;

  /** @private {string} debuggee id provided by the server once registered */
  this.debuggeeId_ = null;

  /** @private {string} a descriptor of the current code version */
  this.descriptor_ = config.description;

  /** @private {string} the service name of the current code */
  this.serviceName_ = config.serviceContext && config.serviceContext.service;

  /** @private {string} the version of the current code */
  this.serviceVersion_ = config.serviceContext && config.serviceContext.version;
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
Controller.prototype.init = function(uid, logger, callback) {
  var that = this;
  that.uid_ = uid;
  that.nextWaitToken_ = null;

  function complete(err, project) {
    if (err) {
      callback(err, project);
      return;
    }
    that.project_ = project;

    fs.readFile('source-context.json', 'utf8', function(err, data) {
      try {
        that.sourceContext_ = JSON.parse(data);
      } catch (e) {
        logger.warn('Malformed source-context.json file.');
        // But we keep on going.
      }
      callback(null, project);
    });
  }

  utils.getProjectNumber(function(err, project) {
    that.onGCP = !!project;
    if (process.env.GCLOUD_PROJECT) {
      complete(null, process.env.GCLOUD_PROJECT);
    } else {
      complete(err, project);
    }
  });
};

/**
 * Register to the API
 * @param {!function(?Error,Object=)} callback
 */
Controller.prototype.register = function(callback) {
  this.register_(null, callback);
};


/**
 * Register an error to the API
 * @param {!string} errorMessage to be reported to the Debug API
 */
Controller.prototype.registerError = function(message) {
  this.register_(message, function() {});
};


/**
 * Register to the API (implementation)
 * @param {?string} errorMessage Should be null for normal startup, and non-
 *     null if there is a startup error that should be reported to the API
 * @param {!function(?Error,Object=)} callback
 * @private
 */
Controller.prototype.register_ = function(errorMessage, callback) {
  var that = this;

  var cwd = process.cwd();
  var mainScript = path.relative(cwd, process.argv[1]);

  var version = 'google.com/node-' +
    (that.onGCP ? 'gcp' : 'standalone') +
    '/v' + pjson.version;
  var desc = process.title + ' ' + mainScript;
  var labels = {
    'main script': mainScript,
    'process.title': process.title,
    'node version': process.versions.node,
    'V8 version': process.versions.v8,
    'agent.name': pjson.name,
    'agent.version': pjson.version,
    'projectid': that.project_
  };

  var serviceName = that.serviceName_;
  if (serviceName) {
    desc += ' module:' + serviceName;
    labels[DEBUGGEE_MODULE_LABEL] = serviceName;
  }

  var serviceVersion = that.serviceVersion_;
  if (serviceVersion) {
    desc += ' version:' + serviceVersion;
    if (serviceVersion !== 'default') {
      labels[DEBUGGEE_MAJOR_VERSION_LABEL] = serviceVersion;
    }
  }

  var descriptor = that.descriptor_;
  if (descriptor) {
    desc += ' description:' + descriptor;
  }

  if (process.env.GAE_MINOR_VERSION) {
    labels[DEBUGGEE_MINOR_VERSION_LABEL] = process.env.GAE_MINOR_VERSION;
  }

  var uniquifier = desc + version + that.uid_ + that.sourceContext_ +
    JSON.stringify(labels);
  uniquifier  = crypto.createHash('sha1').update(uniquifier).digest('hex');

  var debuggee = {
    project: that.project_,
    uniquifier: uniquifier,
    description: desc,
    agentVersion: version,
    labels: labels,
    sourceContexts: [that.sourceContext_]
  };

  if (errorMessage) {
    debuggee.status = new StatusMessage(StatusMessage.UNSPECIFIED, errorMessage,
                                        true);
  }

  var options = {
    uri: API + '/debuggees/register',
    method: 'POST',
    json: true,
    body: { debuggee: debuggee }
  };
  this.debug_.request(options, function(err, body, response) {
    if (err) {
      callback(err);
    } else if (response.statusCode !== 200) {
      callback(new Error('unable to register, statusCode ' + response.statusCode));
    } else if (!body.debuggee) {
      callback(new Error('invalid response body from server'));
    } else if (body.debuggee.isDisabled) {
      callback('Debuggee is disabled on server');
    } else {
      that.debuggeeId_ = body.debuggee.id;
      callback(null, body);
    }
  });
};


/**
 * Fetch the list of breakpoints from the server. Assumes we have registered.
 * @param {!function(?Error,Object=,Object=)} callback accepting (err, response, body)
 */
Controller.prototype.listBreakpoints = function(callback) {
  var that = this;
  assert(that.debuggeeId_, 'should register first');
  var query = { success_on_timeout: true };
  if (that.nextWaitToken_) {
    query.waitToken = that.nextWaitToken;
  }

  var uri = API + '/debuggees/' + encodeURIComponent(that.debuggeeId_) +
      '/breakpoints?' + qs.stringify(query);
  that.debug_.request({uri: uri, json: true}, function(err, body, response) {
    if (!response) {
      callback(err || new Error('unknown error - request response missing'));
      return;
    } else if (response.statusCode === 404) {
      // The v2 API returns 404 (google.rpc.Code.NOT_FOUND) when the agent
      // registration expires. We should re-register.
      callback(null, response);
      return;
    } else if (response.statusCode !== 200) {
      callback(new Error('unable to list breakpoints, status code ' +
        response.statusCode));
      return;
    } else {
      body = body || {};
      that.nextWaitToken_ = body.nextWaitToken;
      callback(null, response, body);
    }
  });
};

/**
 * Update the server about breakpoint state
 * @param {!Breakpoint} breakpoint
 * @param {!Function} callback accepting (err, body)
 */
Controller.prototype.updateBreakpoint =
  function(breakpoint, callback) {
    assert(this.debuggeeId_, 'should register first');

    breakpoint.action = 'capture';
    breakpoint.isFinalState = true;
    var options = {
      uri: API + '/debuggees/' + encodeURIComponent(this.debuggeeId_) +
        '/breakpoints/' + encodeURIComponent(breakpoint.id),
      json: true,
      method: 'PUT',
      body: {
        debuggeeId: this.debuggeeId_,
        breakpoint: breakpoint
      }
    };

    // We need to have a try/catch here because a JSON.stringify will be done
    // by request. Some V8 debug mirror objects get a throw when we attempt to
    // stringify them. The try-catch keeps it resilient and avoids crashing the
    // user's app.
    try {
      this.debug_.request(options, function(err, body, response) {
        callback(err, body);
      });
    } catch (error) {
      callback(error);
    }
  };

module.exports = Controller;
