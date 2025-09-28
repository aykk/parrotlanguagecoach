#!/bin/bash

# Start the lightweight lip reading service
echo "Starting lightweight lip reading service..."

cd compvis/services/lipread

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements_lightweight.txt

# Start the service
echo "Starting service on port 8000..."
python app_lightweight.py
