# SCRGIT

Finds and enumerates appsscript projects on github

## Cache

Results are compressed and written to a Gist file for visualization by a client such as vizzygit

## cli options

| option | meaning |
| ---- | ---- |
| -f | force cache update - otherwise it just reads and validates existing cache |
| -m | max number to read from git hub - usually only for testing |
| -t | test mode - data pulled from git hub and processed but cache is not updated |
