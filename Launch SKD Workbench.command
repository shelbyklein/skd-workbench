#!/bin/zsh -l
cd -- "${0:A:h}"
exec node server.js --open
