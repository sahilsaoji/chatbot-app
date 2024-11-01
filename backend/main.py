import os
import sys
import re
import json
from io import StringIO

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

# Initialize FastAPI application
application = FastAPI()

# Configure CORS middleware
application.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify to limit allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Expose 'application' as 'app' for ASGI server compatibility
app = application

# Set up OpenAI client with API key from environment
openai_client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
)

# Define models for requests and responses
class QueryRequest(BaseModel):
    prompt: str
    csv_data: str

class QueryResponse(BaseModel):
    response: str
    vega_lite_json: Optional[str]

class CodeResponse(BaseModel):
    code: str

def clean_input(text: str) -> str:
    """Sanitize input for the Python REPL by removing unnecessary characters."""
    text = re.sub(r"^(\s|`)*(?i:python)?\s*", "", text)
    text = re.sub(r"(\s|`)*$", "", text)
    return text

def execute_pandas_code(code_snippet):
    """Execute the provided Python code and return any output."""
    original_stdout = sys.stdout
    sys.stdout = captured_output = StringIO()
    try:
        cleaned_code = clean_input(code_snippet)
        exec(cleaned_code)
        sys.stdout = original_stdout
        return captured_output.getvalue()
    except Exception as e:
        sys.stdout = original_stdout
        return repr(e)

# Functions to print colored messages
def print_in_red(*args):
    print("\033[91m" + " ".join(args) + "\033[0m")

def print_in_blue(*args):
    print("\033[94m" + " ".join(args) + "\033[0m")

# Define tool configurations for executing code and generating outputs
execute_pandas_code_tool = {
    "type": "function",
    "function": {
        "name": "execute_pandas_code",
        "description": "Executes the provided Python code.",
        "parameters": {
            "type": "object",
            "properties": {
                "code_snippet": {
                    "type": "string",
                    "description": "The Python code to execute."
                }
            },
            "required": ["code_snippet"],
            "additionalProperties": False
        }
    }
}

generate_code_tool = {
    "type": "function",
    "function": {
        "name": "generate_code",
        "description": "Generate Python code to accomplish the specified task using provided data.",
        "parameters": {
            "type": "object",
            "properties": {
                "code_task": {
                    "type": "string",
                    "description": "The task to generate Python code for."
                },
                "input_data": {
                    "type": "string",
                    "description": "The data to be used in the Python code."
                }
            },
            "required": ["code_task", "input_data"],
            "additionalProperties": False
        }
    }
}

generate_vega_lite_json_tool = {
    "type": "function",
    "function": {
        "name": "generate_vega_lite_json",
        "description": "Produce a Vega-Lite JSON specification for the provided data.",
        "parameters": {
            "type": "object",
            "properties": {
                "chart_data": {
                    "type": "string",
                    "description": "The data for generating the Vega-Lite JSON specification."
                },
                "chart_prompt": {
                    "type": "string",
                    "description": "The prompt to generate the Vega-Lite JSON specification from."
                }
            },
            "required": ["chart_data", "chart_prompt"],
            "additionalProperties": False
        }
    }
}

def generate_code(code_task, input_data):
    """Produce Python code to execute the specified task using the given data."""
    code_prompt = f"Generate Python code to perform the following task: {code_task} using the data {input_data}. Print the result using print(result). The code should be solely for calculations, not for graphing or visualization."

    assistant_instructions = """You are a helpful AI assistant.
Use your coding and language skills to solve tasks.
Suggest Python code for execution when necessary.
If you need to gather information, use code to output what you need, such as browsing, reading files, or checking the current date/time.
Use code to perform tasks and output results. Plan your approach clearly, indicating which steps use code and which use your language skills.
When using code, specify the script type. Users cannot modify your code, so avoid incomplete suggestions.
Only include one code block per response, and do not ask users to copy and paste results. Use the 'print' function for outputs when applicable.
If errors arise, correct them and provide the full code again. Analyze and revisit your assumptions if the task remains unresolved.
Verify your answers and include verifiable evidence where possible. Do not create visualizations or import visualization libraries.
"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": assistant_instructions},
            {"role": "user", "content": code_prompt}
        ],
        response_format=CodeResponse
    )

    return CodeResponse(code=response.choices[0].message.parsed.code)

def generate_vega_lite_json(chart_data, chart_prompt):
    """Create a Vega-Lite JSON specification based on the provided data and prompt."""
    vega_lite_prompt = f"Generate a Vega-Lite JSON specification for the following data: {chart_data} based on the prompt: {chart_prompt}."

    assistant_instructions = """You are an AI assistant tasked with generating Vega-Lite specifications. Please adhere to the following structure: {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    width: 400,
    height: 200,
    "mark": "bar",
    "data": {
        "values": [
            {"category": "A", "group": "x", "value": 0.1},
            {"category": "A", "group": "y", "value": 0.6},
            {"category": "A", "group": "z", "value": 0.9},
            {"category": "B", "group": "x", "value": 0.7},
            {"category": "B", "group": "y", "value": 0.2},
            {"category": "B", "group": "z", "value": 1.1},
            {"category": "C", "group": "x", "value": 0.6},
            {"category": "C", "group": "y", "value": 0.1},
            {"category": "C", "group": "z", "value": 0.2}
        ]
    },
    "encoding": {
        "x": {"field": "category"},
        "y": {"field": "value", "type": "quantitative"},
        "xOffset": {"field": "group"},
        "color": {"field": "group"}
    }
}

Ensure to include the schema, data, and mark field, while the encoding should accurately reflect the appropriate fields and types. Store the Vega-Lite specification in the variable vega_lite_json. Do not include the specification in the response variable. Use the response variable for relevant information only. If visualization generation fails, return an empty Vega-Lite JSON specification.
"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": assistant_instructions},
            {"role": "user", "content": vega_lite_prompt}
        ],
        response_format=QueryResponse
    )

    if "mark" not in response.choices[0].message.parsed.vega_lite_json:
        return QueryResponse(response="An issue occurred while generating the visualization. Please try again.", vega_lite_json="")

    return QueryResponse(
        response=response.choices[0].message.parsed.response,
        vega_lite_json=response.choices[0].message.parsed.vega_lite_json
    )

# Define tools for the application
available_tools = [execute_pandas_code_tool, generate_code_tool, generate_vega_lite_json_tool]
function_map = {
    "execute_pandas_code": execute_pandas_code,
    "generate_code": generate_code,
    "generate_vega_lite_json": generate_vega_lite_json
}

def process_query(user_query, assistant_instructions, available_tools, function_map, max_iterations=10):
    """Process a query, utilizing available tools and tracking iterations."""
    messages = [{"role": "system", "content": assistant_instructions}]
    messages.append({"role": "user", "content": user_query})
    vega_lite_json = ""
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        print("Iteration:", iteration)

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini", temperature=0.0, messages=messages, tools=available_tools
        )

        if response.choices[0].message.content:
            print_in_red(response.choices[0].message.content)

        if response.choices[0].message.tool_calls is None:
            break  # Exit if no function calls

        messages.append(response.choices[0].message)  # Track conversation

        for tool_call in response.choices[0].message.tool_calls:
            print_in_blue("Calling:", tool_call.function.name, "with", tool_call.function.arguments)
            arguments = json.loads(tool_call.function.arguments)
            function_to_call = function_map[tool_call.function.name]
            output = function_to_call(**arguments)

            if tool_call.function.name == "generate_vega_lite_json":
                vega_lite_json = output.vega_lite_json

            # Create message containing the result of the function call
            result_content = json.dumps({**arguments, "result": str(output)})
            function_call_result_message = {
                "role": "tool",
                "content": result_content,
                "tool_call_id": tool_call.id,
            }
            print_in_blue("Action result:", result_content)

            messages.append(function_call_result_message)

        if iteration == max_iterations and response.choices[0].message.tool_calls:
            print_in_red("Maximum iterations reached")
            return QueryResponse(response="The tool agent could not complete the task in the given time. Please try again.", vega_lite_json="")

    return QueryResponse(response=response.choices[0].message.content, vega_lite_json=vega_lite_json)

@application.post("/query", response_model=QueryResponse)
async def query_openai(user_request: QueryRequest):
    """Handle POST requests for querying OpenAI with provided data."""
    try:
        if json.loads(user_request.csv_data) == []:
            return QueryResponse(response="Please provide valid CSV data.", vega_lite_json="")

        full_prompt = user_request.prompt + user_request.csv_data
        assistant_instructions = """
            You are a helpful assistant. Use the supplied tools to assist the user when necessary.
            Assess if the user's question pertains to the provided data. If not, ask
            for a relevant prompt. Use the response variable for explanations, and store
            the Vega-Lite specification in the vega_lite_json variable.
            After generating code, execute it with the available tools. Do not inform the user about
            any generated code or execution results.
            All visualizations should be handled with the provided tool, not through code.
            Do not display any generated Vega-Lite specifications to the user.
            While users may pose questions unrelated to the data, maintain focus on the data
            and return an empty Vega-Lite JSON specification along with an explanation.
        """
        return process_query(full_prompt, assistant_instructions, available_tools, function_map)
    except Exception as e:
        return QueryResponse(response="An error occurred. Please try again.", vega_lite_json="")
