 #!/bin/bash

path=$HTTP_DIR/../demo/$2
mkdir -p $path
rsync -a --exclude='.*' . $path
