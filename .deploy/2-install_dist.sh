 #!/bin/bash

path=$HTTP_DIR/projects/$2
mkdir -p $path
rsync -a --exclude='.*' . $HTTP_DIR/projects/$2
