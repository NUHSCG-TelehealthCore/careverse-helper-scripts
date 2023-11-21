#!/bin/bash
# Define variables
LAMBDA_FUNCTION_NAME="your_lambda_function_name"
ZIP_FILE="lambda_function.zip"
SOURCE_DIRECTORY="path_to_your_source_code_directory"
# Zip the source code
cd $SOURCE_DIRECTORY
zip -r ../$ZIP_FILE .
# Move back to the original directory
cd -
# Update the Lambda function code
aws lambda update-function-code --function-name $LAMBDA_FUNCTION_NAME --zip-file fileb://$ZIP_FILE
# Optional: Remove the zip file after upload
# rm $ZIP_FILE