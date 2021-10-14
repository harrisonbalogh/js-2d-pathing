 #!/bin/bash

path=/var/www/staging/projects/js-2d-pathing
mkdir -p $path
rsync -a --exclude='.*' ./ $path
