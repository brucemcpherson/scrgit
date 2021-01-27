# SCRGIT

Finds and enumerates appsscript projects on github

## Cache and client

Results are compressed and written to a Gist file for visualization by a client such as scrviz 

https://scrviz.web.app
https://github.com/brucemcpherson/gitvizzy

## credentials

You need to make secrets/git.js with your credentials. One with read access to github repos and another with write access for gists.

````
const auth = "xxx"; 
const gistAuth = "xxx";

module.exports = {
  auth,
  gistAuth
};
````

## cli options

| option | meaning |
| ---- | ---- |
| -f | force cache update - otherwise it just reads and validates existing cache |
| -m | max number to read from git hub - usually only for testing |
| -t | test mode - data pulled from git hub and processed but cache is not updated |
| -c | create a brand new, empty cache file |
| -o | output to a file |

# Merging

Because the Github API returns random results for a search, you won't ever get them all. For best coverage, run index.js several times with the -o flag to create a number of views, then run merge.js to consolidate the contents of all of those.

## cli options

These apply to merge.js

| option | meaning |
| ---- | ---- |
| -n | a comma delimited set of files names to merge |
| -t | test mode - data consolidated but not written to cache |
| -o | output to a file |