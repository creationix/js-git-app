"use strict";

var tcp = require('min-stream-chrome');
var min = require('min-stream');
var domBuilder = require('dombuilder');
var pktLine = require('min-stream-pkt-line');
var log = require('domlog');
var bops = require('bops');
window.log = log;

document.body.innerText = "";
document.body.appendChild(domBuilder([
  ["h1", "JS-Git Chrome App"],
  ["form",
    {onsubmit: wrap(function (evt) {
      evt.preventDefault();
      clone(this.url.value, this.sideband.checked);
    })},
    ["input", {name: "url", value: "git://github.com/creationix/conquest.git"}],
    ["input", {type:"submit", value: "Clone!"}],
    ["label",
      ["input", {type:"checkbox", name:"sideband"}],
      "Include side-band support",
    ]
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

function clone(url, sideband) {
  url = parseUrl(url);
  log("Parsed Url", url);
  tcp.connect(url.host, url.port, check(function (socket) {

    min.chain
      .source(socket.source)
      .map(logger("<"))
      .push(pktLine.deframer)
      .map(logger("<-"))
      .pull(app)
      .map(logger("->"))
      .push(pktLine.framer)
      .map(logger(">"))
      .sink(socket.sink);

    log("Connected to server");

  }));


  function app(read) {

    var sources = min.demux(["line", "pack", "progress", "error"],
      read
    );

    min.consume(sources.line, log);

    var output = tube();

    output.write(null, pktLine.encode(["git-upload-pack", url.path], {host: url.host}, true));
    sources.line(null, function (err, item) {
      log({err:err,item:item});
    });

    return output;
  }

}

function logger(message) {
  return function (item) {
    log([message, item]);
    return item;
  };
}

function tube() {
  var dataQueue = [];
  var readQueue = [];
  var callbackList = [];
  var closed;
  function check() {
    while (!closed && readQueue.length && dataQueue.length) {
      readQueue.shift().apply(null, dataQueue.shift());
    }
    if (callbackList.length && !dataQueue.length) {
      var callbacks = callbackList;
      callbackList = [];
      callbacks.forEach(function (callback) {
        callback(closed === true ? null : closed);
      });
    }
  }
  function write(err, item, callback) {
    if (closed) return callback && callback(closed === true ? null : closed);
    dataQueue.push([err, item]);
    if (callback) callbackList.push(callback);
    check();
  }
  function read(close, callback) {
    if (closed) return callback(closed === true ? null : closed);
    if (close) {
      closed = close;
      return callback();
    }
    readQueue.push(callback);
    check();
  }
  read.write = write;
  return read;
}
