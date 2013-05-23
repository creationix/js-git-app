"use strict";

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');
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

    log("Connected to server");
    helpers.run([
      socket.source,
      pktLine.deframer,
      // helpers.mapToPull(function (item) {
      //   log("<-", item);
      //   return item;
      // }),
      app,
      // helpers.mapToPull(function (item) {
      //   log("->", item);
      //   return item;
      // }),
      pktLine.framer,
      socket.sink
    ]);

  }));


  app.is = "min-stream-pull-filter";
  function app(read) {
    
    var sources = helpers.demultiplexer(["line", "pack", "progress", "error"],
      read
    );
    
    helpers.sink(log)(sources.line);
    
    var output = helpers.source();
    
    output.write(null, pktLine.encode(["git-upload-pack", url.path], {host: url.host}, true));
    sources.line(null, function (err, item) {
      log({err:err,item:item});
    });
    
    return output;
  }



}

