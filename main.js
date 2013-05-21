"use strict";

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');
var domBuilder = require('dombuilder');
var log = require('domlog');

document.body.innerText = "";
document.body.appendChild(domBuilder([
  ["h1", "JS-Git Chrome App"],
  ["form",
    {onsubmit: function (evt) {
      evt.preventDefault();
      var err = clone(this.url.value);
      if (err) log("ERROR: " + err);
    }},
    ["input", {name: "url", value: "git://github.com/creationix/conquest.git"}],
    ["input", {type:"submit", value: "Clone!"}]
  ]
]));

log.setup();
log.container.style.top = "150px";
log.container.style.height = "auto";
log.container.style.background = "#222";

var remoteMatch = new RegExp("^git://([^/:]+)(?::([0-9]+))?(/.*)$");

function clone(url) {
  var match = url.match(remoteMatch);
  if (!match) return "Please enter a valid git:// url";
  var host = match[1];
  var port = match[2] ? parseInt(match[2], 10) : 9418;
  var path = match[3];
  log("Parsed Url", {host:host,port:port,path:path});
  log({tcp:tcp});
}
