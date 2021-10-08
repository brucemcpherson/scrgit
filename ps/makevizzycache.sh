# make all pubsub topics and subs
SA="scrviz-pubsub@scrviz.iam.gserviceaccount.com"
AD="420"
bash createps.sh  psp vizzycache "$SA" $AD 

# update endpoints for push type because this runs in apps script
EP="https://script.google.com/macros/s/AKfycbxuk_7Fnoh-M63LjqkQc8JAPeuUtABmVyxWvIQgNwh4HH-UsAOt/exec"
gcloud pubsub subscriptions update projects/scrviz/subscriptions/scrgit-vizzycache-psp --push-endpoint="$EP"
gcloud pubsub subscriptions update projects/scrviz/subscriptions/scrgit-vizzycache-psp-test --push-endpoint="$EP" --push-auth-service-account="$SA"
