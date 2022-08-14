 #!/bin/bash

if [ $# -ne 1 ] || [ ! -d "$1" ]
then
  exit 1
fi

path=$HTTP_DIR/projects/$2
mkdir -p $path
rsync -a --exclude='.*' . $HTTP_DIR/projects/$2
