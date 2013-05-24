js-git-app
==========

A js-git packaged app for chrome and chromebooks.

## To run this app

 1. Clone to computer or download and unzip.
 2. Install the dependencies using `npm install`
 3. Load this folder as an unpacked extension at <chrome://extensions>.

## Progress

Currently this chrome app does the following things:

 - Connect to github over a raw TCP socket using a special chrome API
 - Codec for pkt-line message framing on the binary stream
 - Parser and encoder for the contents of some git line messages
 - side-band parsing and multiplexing/demultiplexing of streams
 - Ref discovery
 - Stream of raw pack data

 TODO:

  - Hook raw pack stream to Chris Dickinson's pack parser
  - Store resulting object stream to persistent storage
  - Implement index and working files
  - Plan more awesome stuff.
