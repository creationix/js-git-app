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
    ["input", {name: "url", size: 50, value: "git://github.com/creationix/conquest.git"}],
    ["input", {type:"submit", value: "Clone!"}],
    ["label",
      ["input", {type:"checkbox", checked:true, name:"sideband"}],
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
  log.container.textContent = "";
  url = parseUrl(url);
  log("Parsed Url", url);
  tcp.connect(url.host, url.port, check(function (socket) {

    log("Connected to server");

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
  }));


  function app(read) {

    var sources = min.demux(["line", "pack", "progress", "error"], read);

    var output = tube();

    log("Sending upload-pack request...");
    output.write(null, pktLine.encode(["git-upload-pack", url.path], {host: url.host}, true));

    var refs = {};
    var caps;

    consumeTill(sources.line, function (item) {
      if (item) {
        item = pktLine.decode(item);
        if (item.caps) caps = item.caps;
        refs[item[1]] = item[0];
        return true;
      }
    }, function (err) {
      if (err) return log(err);
      log({caps:caps,refs:refs});
      var clientCaps = {};
      if (sideband) {
        if (caps["side-band-64k"]) {
          clientCaps["side-band-64k"] = true;
        }
        else if (caps["side-band"]) {
          clientCaps["side-band"] = true;
        }
      }
      output.write(null, ["want", refs.HEAD, pktLine.capList(clientCaps)].join(" ") + "\n");
      output.write(null, null);
      output.write(null, "done");

      devNull(sources.line);
      devNull(sources.pack);
      devNull(sources.progress);
      devNull(sources.error);
    });

    return output;
  }

}

function logger(message) {
  return function (item) {
    log(message, item);
    return item;
  };
}

// Eat all events in a stream
function devNull(read) {
  read(null, onRead);
  function onRead(err, item) {
    if (err) log(err);
    else if (item !== undefined) read(null, onRead);
  }
}

function consumeTill(read, check, callback) {
  read(null, onRead);
  function onRead(err, item) {
    if (item === undefined) {
      if (err) return callback(err);
      return callback();
    }
    if (!check(item)) return callback();
    read(null, onRead);
  }
}

function tube() {
  var dataQueue = [];
  var readQueue = [];
  var closed;
  function check() {
    while (!closed && readQueue.length && dataQueue.length) {
      readQueue.shift().apply(null, dataQueue.shift());
    }
  }
  function write(err, item) {
    dataQueue.push([err, item]);
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
