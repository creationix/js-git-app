#!/bin/sh
VERSION=`node -pe 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8")).version'`
FILE="../js-git-app-$VERSION.zip"
rm -f $FILE
zip -r9o $FILE . -x '.*' '*/.*' tags package.sh
echo "Saved to $FILE"
