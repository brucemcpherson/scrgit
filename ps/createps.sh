RO="roles/editor"
P="scrviz"
M=$1
T=$2
SA="serviceAccount:$3"
AD=$4

NAT="scrgit-$T-$M"
NAS="scrgit-$T-$M"
NATT="scrgit-$T-$M-test"
NAST="scrgit-$T-$M-test"
# test ack deadline
TD=20
# message duration
MD="60m"
TMD="10m"
gcloud config set project $P
gcloud pubsub subscriptions delete projects/$P/subscriptions/$NAST
gcloud pubsub subscriptions delete projects/$P/subscriptions/$NAS
gcloud pubsub topics delete projects/$P/topics/$NAT
gcloud pubsub topics delete projects/$P/topics/$NATT
gcloud pubsub topics create $NAT
gcloud pubsub topics create $NATT
gcloud pubsub topics add-iam-policy-binding $NAT --member="$SA" --role=$RO
gcloud pubsub topics add-iam-policy-binding $NATT --member="$SA" --role=$RO
gcloud pubsub subscriptions create $NAS --topic=projects/$P/topics/$NAT --ack-deadline=$AD --expiration-period=never --message-retention-duration=$MD
gcloud pubsub subscriptions add-iam-policy-binding $NAS --member="$SA" --role="$RO"
gcloud pubsub subscriptions create $NAST --topic=projects/$P/topics/$NATT --ack-deadline=$TD --expiration-period=never --message-retention-duration=$TMD
gcloud pubsub subscriptions add-iam-policy-binding $NAST --member="$SA" --role="$RO"

