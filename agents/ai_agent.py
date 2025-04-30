import os
from openai import OpenAI
from openai.error import OpenAIError

class CodeGuardianAgent:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("Missing OpenAI API key.")
        self.client = OpenAI(api_key=self.api_key)

    def ask(self, prompt: str, model: str = "gpt-4", temperature: float = 0.5) -> str:
        """
        Send a chat-completion request to the OpenAI API.
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()
        except OpenAIError as e:
            raise RuntimeError(f"OpenAI API error: {e}")
