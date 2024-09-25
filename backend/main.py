from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import uvicorn
import logging

# Load environment variables (like API keys) from the .env file
load_dotenv()

app = FastAPI(debug=True)

client = OpenAI()

# Set up logging to track app behavior and errors
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the OpenAI API key from the environment variables
api_key = os.environ.get("OPENAI_API_KEY")

# If the API key is not found, raise an error
if not api_key:
    raise HTTPException(status_code=500, detail="OpenAI API key is missing")

# Set the OpenAI API key for requests
openai.api_key = api_key

# Enable CORS (Cross-Origin Resource Sharing) to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow requests from all origins
    # Allow credentials (cookies, authorization headers)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"]  # Allow all headers
)

# Define models for handling request and response data


class QueryRequest(BaseModel):
    prompt: str  # User's question for data visualization
    data: list  # Parsed CSV data sent from the frontend


class QueryResponse(BaseModel):
    description: str  # Description of the chart
    chartSpec: dict  # Vega-Lite chart specification

# Define the main POST endpoint to process user queries


@app.post("/query/", response_model=QueryResponse)
async def query_openai(request: QueryRequest):
    logger.info(f"Received a new request with prompt: {request.prompt}")

    # Check if data has been uploaded
    if not request.data:
        return QueryResponse(response="No dataset uploaded. Please upload a dataset to generate charts.", chartSpec={})

    try:
        # Extract column names and types from the dataset
        # Get column names from the first row
        columns = list(request.data[0].keys())
        column_types = {col: "categorical" if isinstance(
            request.data[0][col], str) else "quantitative" for col in columns}
        # Limit dataset to first 50 rows for processing
        full_data = request.data[:50]

        # Construct the prompt for OpenAI to generate a chart specification
        prompt = f"""
        You are a data visualization assistant. A user has provided a dataset with the following columns:
        {json.dumps(column_types, indent=2)}. 
        Here is the full dataset: {json.dumps(full_data, indent=2)}.
        The user has asked the following question: {request.prompt}.
        
        You must generate a valid Vega-Lite JSON chart specification and a short description of the chart based on the user's question. Ensure your description is placed in a 'description' key in the JSON object.
        """

        # Log the constructed prompt for debugging purposes
        logger.info(f"Constructed prompt: {prompt}")

        # Send the prompt to OpenAI and get a response
        gpt_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "assistant", "content": "You are a data visualization assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.25,  # Control creativity of the response
            n=1,
            response_format={"type": "json_object"}  # Expect JSON response
        )

        # Extract the generated message from the response
        gpt_message = gpt_response.choices[0].message.content

        # Parse the GPT-4 response into JSON
        chart_response_json = json.loads(gpt_message)

        # Extract the chart description and Vega-Lite specification
        description = chart_response_json.get("description", "")
        chart_spec = {key: chart_response_json[key]
                      for key in chart_response_json if key != "description"}

        # Return the response containing the description and chart specification
        return QueryResponse(
            description=description,
            chartSpec=chart_spec
        )

    # Handle OpenAI API rate limit errors
    except openai.RateLimitError as e:
        logger.error(f"RateLimitError: {str(e)}")
        raise HTTPException(
            status_code=499, detail=f"OpenAI API error: {str(e)}")

    # Handle errors during JSON parsing
    except json.JSONDecodeError as e:
        logger.error(f"JSONDecodeError: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"JSON decode error: {str(e)}")

    # Catch any unexpected errors and log them
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Unexpected error: {str(e)}")

# Define a simple root endpoint to check if the API is running


@app.get("/")
async def read_root():
    return {"message": "API is running"}

# Handle port configuration for deployment on Render
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
