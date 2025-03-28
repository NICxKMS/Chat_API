# Define your Gemini API key
$apiKey = "AIzaSyCNRJlfY72IvjdSNALid8aVl4bNRUwdiEQ"

# Set the endpoint URL for listing models
$url = "https://generativelanguage.googleapis.com/v1beta/models?key=$apiKey"

# Send the GET request to the Gemini API
$response = Invoke-RestMethod -Uri $url -Method Get

# Extract and display the model names
$models = $response.models | Select-Object -ExpandProperty name
$models
