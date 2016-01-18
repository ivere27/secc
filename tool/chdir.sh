#!/bin/sh
export TMPDIR='/tmp';
cd "$1";
shift;
eval "$@"
