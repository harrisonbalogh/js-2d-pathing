 #!/bin/bash

svn checkout https://github.com/$1.git/trunk/dist . \
  --username harrisonbalogh@gmail.com \
  --password $SVN_SECRET \
  --no-auth-cache \
  --non-interactive
