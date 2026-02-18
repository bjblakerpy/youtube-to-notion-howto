#!/bin/bash

# Exit on error
set -e

APP_NAME="youtube-to-notion"
REGION="us-central1"

# Check dependencies
if ! command -v gcloud &> /dev/null; then
    echo "gcloud command not found. Please install Google Cloud SDK."
    exit 1
fi

echo "Deploying $APP_NAME to Cloud Run..."

# 1. Build and submit image to Cloud Build (or just deploy source directly)
# Deploying from source is easiest for Cloud Run
gcloud run deploy $APP_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"

# Note: Secrets should ideally be managed via Secret Manager, but for this MVP, 
# you can set them in the console or pass them via --set-env-vars if you want to script it (less secure).
# We will print instructions.

echo "Deployment initiated. You may need to set environment variables in the Cloud Run console:"
echo "- WEBHOOK_SECRET"
echo "- GEMINI_API_KEY"
echo "- NOTION_API_KEY"
echo "- NOTION_DEFAULT_PARENT_ID"
echo "- NOTION_DEFAULT_PARENT_TYPE"
