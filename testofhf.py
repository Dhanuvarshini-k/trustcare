import os
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

hf_token = os.getenv("HUGGINGFACE_API_KEY")

# Initialize client with explicit model target
client = InferenceClient(
    token=hf_token
)

# Send request via chat completion interface
messages = [
    {
        "role": "system", 
        "content": "You are a specialized clinical decision support AI."
    },
    {
        "role": "user", 
        "content": "What are the key symptoms of acute myocardial infarction?"
    }
]

response = client.chat_completion(
    model="BioMistral/BioMistral-7B",
    messages=messages,
    max_tokens=200,
    temperature=0.2
)

print("BioMistral Response:\n", response.choices[0].message.content)