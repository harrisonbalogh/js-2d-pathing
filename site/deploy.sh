 #!/bin/bash

if [ $# -ne 1 ] || [ ! -d "$1" ]
then
  exit 1
fi

path=/var/www/staging/projects/js-2d-pathing
mkdir -p $path
(cd $1; rsync -a --exclude='.*' $1 $path)
