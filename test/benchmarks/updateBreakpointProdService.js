var debugTransport = require('../../lib/debugTransport.js');
var DebugletApi = require('../../lib/debugletapi.js');

var RED_TEXT = "\033[31m";
var NORMAL_TEXT = "\033[0m";
var GREEN_TEXT = "\033[32m";
var WHITE_TEXT = "\033[37m";
var MAGENTA_TEXT = "\033[35m";
var CYAN_TEXT = "\033[36m";

var STUB_UID = "SHA1-e66f38150910814d912ffca7de896c1af3627f8f";
var STUB_DESCRIPTOR = "a_descriptor_of_some_value";
var STUB_LOGGER = console;
var rootApiInstance = new DebugletApi();

function apiInterfaceFetchedBreakPoints ( debugletApiInstance, err, statusCode, response ) {

  if ( err ) {

    console.log(RED_TEXT+"!! The api interface failed to fetch breakpoints !!");
    console.log(err.error);
    console.log(NORMAL_TEXT);

    return ;
  }

  console.timeEnd(GREEN_TEXT+"API_INTERFACE_FETCHED_BREAKPOINTS");
  console.log(response);
}

function apiInterfaceRegistered ( debugletApiInstance, err, response ) {

  if ( err ) {

    console.log(RED_TEXT+"!! The api interface failed to register !!");
    console.log(err.error);
    console.log(NORMAL_TEXT);

    return ;
  }

  console.timeEnd(GREEN_TEXT+"API_INTERFACE_REGISTERED");
  console.log(MAGENTA_TEXT+"\tClient Id:", response.debuggee.id);
  console.log("\tProject Id:", response.debuggee.labels.projectid);
  console.log(NORMAL_TEXT);

  console.time(GREEN_TEXT+"API_INTERFACE_FETCHED_BREAKPOINTS");
  debugletApiInstance.listBreakpoints(
    apiInterfaceFetchedBreakPoints.bind(null, debugletApiInstance)
  );
}

function apiInterfaceInited ( err, debugletApiInstance ) {

  console.timeEnd(GREEN_TEXT+"API_INTERFACE_INITED");
  console.time(GREEN_TEXT+"API_INTERFACE_REGISTERED");
  debugletApiInstance.register(
    apiInterfaceRegistered.bind(null, debugletApiInstance)
  );
}

console.log(CYAN_TEXT+
            "==================================");
console.log("========= STARTING TESTS =========");
console.log("=================================="+NORMAL_TEXT);

console.time(GREEN_TEXT+"API_INTERFACE_INITED");
rootApiInstance.init(STUB_UID, STUB_LOGGER, apiInterfaceInited);
