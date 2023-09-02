#!/bin/bash
source .env

npm run build

DEPLOYMENT_FILE="kubernetes/deployment.yml"
PACKAGE_NAME=$(jq -r '.name' < package.json)
echo "Package name is $PACKAGE_NAME"
CURRENT_VERSION=$(awk -F 'image: vhalme/|:x86' '/image: vhalme/{sub(/^_/, "", $3); print $3}' "$DEPLOYMENT_FILE")
echo "Current version is $CURRENT_VERSION"
CURRENT_MINOR_VERSION=$(echo "$CURRENT_VERSION" | awk -F'.' '{print $NF}')
echo "Current minor version is $CURRENT_MINOR_VERSION"
NEW_MINOR_VERSION=$((CURRENT_MINOR_VERSION + 1))
echo "New minor version is $NEW_MINOR_VERSION"
NEW_VERSION=$(echo "$CURRENT_VERSION" | sed "s/\.[0-9]*$/.$NEW_MINOR_VERSION/")
echo "New version is $NEW_VERSION"
NEW_IMAGE_NAME="vhalme/$PACKAGE_NAME:x86_$NEW_VERSION"
echo "New image name is $NEW_IMAGE_NAME"
docker images -q vhalme/$PACKAGE_NAME | xargs docker rmi
echo "Building $NEW_IMAGE_NAME"
docker buildx build --platform=linux/amd64 -t $NEW_IMAGE_NAME .
docker push $NEW_IMAGE_NAME
if [ $? -eq 0 ]; then
  kubectl delete deployment $PACKAGE_NAME
  sed "s/x86_$CURRENT_VERSION/x86_$NEW_VERSION/" < "$DEPLOYMENT_FILE" > "tmp.yml" && mv "tmp.yml" "$DEPLOYMENT_FILE"
  echo "Updated image version from x86_$CURRENT_VERSION to x86_$NEW_VERSION in $DEPLOYMENT_FILE."
  envsubst < "$DEPLOYMENT_FILE" | kubectl apply -f -
fi
