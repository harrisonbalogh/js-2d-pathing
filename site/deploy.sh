 #!/bin/bash

if [ $# -ne 1 ] || [ ! -d "$1" ]
then
  exit 1
fi

path=/var/www/staging/projects
mkdir -p $path
rsync -a --exclude='.*' $1 $path
