"use strict";

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');
var domBuilder = require('dombuilder');
var pktLine = require('min-stream-pkt-line');
var log = require('domlog');
var bops = require('bops');

document.body.innerText = "";
document.body.appendChild(domBuilder([
  ["h1", "JS-Git Chrome App"],
  ["form",
    {onsubmit: wrap(function (evt) {
      evt.preventDefault();
      clone(this.url.value);
    })},
    ["input", {name: "url", value: "git://github.com/creationix/conquest.git"}],
    ["input", {type:"submit", value: "Clone!"}]
  ]
]));

log.setup({
  top: "150px",
  height: "auto",
  background: "#222"
});

// Wrap a function in one that redirects exceptions.
// Use for all event-source handlers.
function wrap(fn) {
  return function () {
    try {
      return fn.apply(this, arguments);
    }
    catch (err) {
      log(err);
    }
  };
}
// Same as wrap, but also checks err argument.  Use for callbacks.
function check(fn) {
  return function (err) {
    if (err) return log(err);
    try {
      return fn.apply(this, Array.prototype.slice.call(arguments, 1));
    }
    catch (err) {
      log(err);
    }
  };
}

var gitMatch = new RegExp("^git://([^/:]+)(?::([0-9]+))?(/.*)$");
function parseUrl(url) {
  var match = url.match(gitMatch);
  if (match) {
    return {
      type: "tcp",
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : 9418,
      path: match[3]
    };
  }
  throw new SyntaxError("Invalid url: " + url);
}

function clone(url) {
  url = parseUrl(url);
  log("Parsed Url", url);
  tcp.connect(url.host, url.port, check(function (socket) {

    log("Connected to server");
    helpers.run([
      socket.source,
      pktLine.deframer,
      app,
      pktLine.framer,
      socket.sink
    ]);
    
    
  }));


  app.is = "min-stream-push-filter";
  function app(emit) {
    var state = "ref-discovery";
    var refs = {};
    var caps;
    var states = {
      "ref-discovery": function (message) {
        if (message === null) {
          log({refs:refs,caps:caps});
          var clientCaps = [
            // "multi_ack_detailed",
            // "side-band-64k",
            // "thin-pack",
            // "ofs-delta",
            "agent=js-git/0.0.0"
          ];
          emit(null, pktLine.encode(["want", refs.HEAD].concat(clientCaps)));
          // emit(null, pktLine.encode(["want", refs["refs/heads/master"]]));
          emit(null, null);
          emit(null, pktLine.encode(["done"]));
          state = "pack";
          return;
        }
        message = pktLine.decode(message);
        if (message.caps) {
          caps = message.caps;
          delete message.caps;
        }
        refs[message[1]] = message[0];
      },
      "pack": function (message) {
        // throw new Error
      }
    };
    log("Sending git-upload-pack command");
    emit(null, pktLine.encode(["git-upload-pack", url.path], {host: url.host}, true));
    return wrap(function (err, item) {
      if (err) log(err);
      if (item === undefined) return emit(err);
      log(state, item);
      states[state](item);
    });
  }



}

